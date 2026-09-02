import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionOrigin = `chrome-extension://${extensionId}`;
const authSubject = "integration-user-primary";
const burstAuthSubject = "integration-user-daily-burst";

function assertDedicatedTestDatabase(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  assert.ok(["127.0.0.1", "localhost", "postgres"].includes(parsed.hostname), "integration database must be local or the CI service");
  assert.match(databaseName, /_test$/, "integration database name must end in _test");
}

function fieldsToObject(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    result[fields[index]!] = fields[index + 1]!;
  }
  return result;
}

async function stopWorker(worker: ReturnType<typeof spawn> | undefined): Promise<void> {
  if (!worker || worker.exitCode !== null) return;
  worker.kill("SIGTERM");
  await Promise.race([
    once(worker, "exit"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("usage worker did not stop within 8 seconds")), 8_000))
  ]);
}

test("authenticated API lifecycle persists, deduplicates, and isolates user data", { timeout: 60_000 }, async (context) => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for integration tests");
  assert.ok(redisUrl, "REDIS_URL is required for integration tests");
  assertDedicatedTestDatabase(databaseUrl);

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid: "integration-key", use: "sig" });

  const jwksServer = createServer((request, response) => {
    if (request.url === "/.well-known/jwks.json") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    jwksServer.once("error", reject);
    jwksServer.listen(0, "127.0.0.1", resolve);
  });

  const address = jwksServer.address();
  assert.ok(address && typeof address === "object");
  const issuer = `http://127.0.0.1:${address.port}`;
  const audience = "yor-token-usage-integration";

  Object.assign(process.env, {
    NODE_ENV: "test",
    AUTH_ISSUER: issuer,
    AUTH_AUDIENCE: audience,
    AUTH_JWKS_URL: `${issuer}/.well-known/jwks.json`,
    ALLOWED_EXTENSION_ORIGINS: extensionOrigin,
    LOG_HASH_SECRET: "integration-log-hash-secret-32-bytes-minimum",
    METRICS_BEARER_TOKEN: "integration-metrics-token-24-bytes"
  });

  const [{ buildApp }, { processUsageBatch }] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/services/usageIngestion.js")
  ]);
  const app = await buildApp();
  let usageWorker: ReturnType<typeof spawn> | undefined;

  const signToken = (subject: string, email: string, expirationTime: string | number = "5m") => new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "integration-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(privateKey);

  const token = await signToken(authSubject, "integration@example.com");
  const otherToken = await signToken("integration-user-other", "other@example.com");
  const deviceHeaders = {
    origin: extensionOrigin,
    "x-install-id": "integration-install-0001",
    "x-extension-id": extensionId,
    "x-extension-version": "1.1.0",
    "x-browser": "chromium",
    "x-platform": "integration"
  };
  const baseHeaders = { ...deviceHeaders, authorization: `Bearer ${token}` };

  try {
    await app.ready();
    await app.redis.flushdb();
    await app.prisma.user.deleteMany({
      where: { authSubject: { in: [authSubject, "integration-user-other", burstAuthSubject] } }
    });
    await app.prisma.plan.upsert({
      where: { id: "free" },
      create: {
        id: "free",
        tier: "FREE",
        name: "Free",
        monthlyTokenCap: 100_000,
        maxDevices: 2,
        maxEventsPerDay: 1,
        features: { cloudSync: true }
      },
      update: {
        monthlyTokenCap: 100_000,
        maxDevices: 2,
        maxEventsPerDay: 1
      }
    });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { ok: true });

    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    assert.equal(readiness.statusCode, 200);
    assert.deepEqual(readiness.json(), { ok: true });

    const missingToken = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: deviceHeaders
    });
    assert.equal(missingToken.statusCode, 401);

    const expiredToken = await signToken("integration-user-expired", "expired@example.com", Math.floor(Date.now() / 1_000) - 60);
    const expiredSession = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { ...deviceHeaders, authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(expiredSession.statusCode, 401);

    const untrustedOrigin = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { ...baseHeaders, origin: "https://malicious.example" }
    });
    assert.equal(untrustedOrigin.statusCode, 403);

    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: baseHeaders });
    assert.equal(session.statusCode, 200);
    assert.equal(session.json().user.email, "integration@example.com");
    assert.equal(session.json().device.installId, "integration-install-0001");
    assert.equal(session.json().plan.maxEventsPerDay, 1);
    const userId = session.json().user.id;

    const initialSettings = await app.inject({ method: "GET", url: "/v1/settings", headers: baseHeaders });
    assert.equal(initialSettings.statusCode, 200);
    assert.equal(initialSettings.json().settings, null);

    const settingsV1 = {
      version: 1,
      payload: { version: 1, preferences: { theme: "dark", compact: true } }
    };
    const savedSettings = await app.inject({
      method: "PUT",
      url: "/v1/settings",
      headers: baseHeaders,
      payload: settingsV1
    });
    assert.equal(savedSettings.statusCode, 200);
    assert.equal(savedSettings.json().settings.version, 1);

    const staleSettings = await app.inject({
      method: "PUT",
      url: "/v1/settings",
      headers: baseHeaders,
      payload: settingsV1
    });
    assert.equal(staleSettings.statusCode, 409);
    assert.equal(staleSettings.json().expectedVersion, 2);

    const occurredAt = new Date().toISOString();
    const usagePayload = {
      events: [{
        clientEventId: "integration-event-0001",
        provider: "chatgpt",
        model: "gpt-integration",
        threadId: "integration-thread",
        occurredAt,
        promptTokens: 120,
        outputTokens: 300,
        totalTokens: 420,
        promptHash: "a".repeat(64),
        status: "COMPLETED",
        accuracy: "ESTIMATED",
        schemaVersion: 1,
        measurementMethod: "dom-text-heuristic",
        measurementLevel: "approximation",
        confidence: 0.51,
        errorMarginPercent: 40,
        tokenizer: "none",
        source: "visible provider DOM text",
        metadata: { source: "integration" }
      }]
    };
    const usageHeaders = { ...baseHeaders, "idempotency-key": "integration-idempotency-0001" };
    const queued = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: usageHeaders,
      payload: usagePayload
    });
    assert.equal(queued.statusCode, 202);
    assert.equal(queued.json().accepted, 1);

    const replay = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: usageHeaders,
      payload: usagePayload
    });
    assert.equal(replay.statusCode, 202);
    assert.deepEqual(replay.json(), queued.json());

    const conflict = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: usageHeaders,
      payload: {
        events: [{ ...usagePayload.events[0], clientEventId: "integration-event-0002", totalTokens: 421 }]
      }
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().error, "idempotency_conflict");

    const dailyLimitHeaders = { ...baseHeaders, "idempotency-key": "integration-idempotency-daily-limit" };
    const dailyLimited = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: dailyLimitHeaders,
      payload: {
        events: [{ ...usagePayload.events[0], clientEventId: "integration-event-daily-limit" }]
      }
    });
    assert.equal(dailyLimited.statusCode, 429);
    assert.equal(dailyLimited.json().error, "daily_event_limit_reached");
    assert.equal(dailyLimited.json().accepted, 0);
    assert.equal(dailyLimited.json().queued, false);
    assert.ok(Number(dailyLimited.headers["retry-after"]) >= 1);

    const dailyLimitReplay = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: dailyLimitHeaders,
      payload: {
        events: [{ ...usagePayload.events[0], clientEventId: "integration-event-daily-limit" }]
      }
    });
    assert.equal(dailyLimitReplay.statusCode, 429);
    assert.deepEqual(dailyLimitReplay.json(), dailyLimited.json());
    assert.ok(Number(dailyLimitReplay.headers["retry-after"]) >= 1);

    const queuedMessages = await app.redis.xrange("usage-events", "-", "+");
    assert.equal(queuedMessages.length, 1);
    const queuedJob = JSON.parse(fieldsToObject(queuedMessages[0]![1]).payload!);
    let workerOutput = "";
    usageWorker = spawn(process.execPath, ["dist/jobs/usageWorker.js"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    usageWorker.stdout?.on("data", (chunk) => { workerOutput += chunk.toString(); });
    usageWorker.stderr?.on("data", (chunk) => { workerOutput += chunk.toString(); });
    const workerDeadline = Date.now() + 10_000;
    let persistedUsageEvent = false;
    while (Date.now() < workerDeadline) {
      const storedEvent = await app.prisma.usageEvent.findFirst({
        where: { clientEventId: usagePayload.events[0]!.clientEventId }
      });
      if (storedEvent) {
        persistedUsageEvent = true;
        break;
      }
      if (usageWorker.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(persistedUsageEvent, `usage worker did not persist the queued event: ${workerOutput.slice(-1_000)}`);
    const storedUsage = await app.prisma.usageEvent.findUnique({
      where: { userId_clientEventId: { userId: userId, clientEventId: usagePayload.events[0]!.clientEventId } }
    });
    assert.equal(storedUsage?.measurementMethod, "dom-text-heuristic");
    assert.equal(storedUsage?.measurementLevel, "APPROXIMATION");
    assert.equal(storedUsage?.confidence, 0.51);
    assert.equal(storedUsage?.errorMarginPercent, 40);
    await stopWorker(usageWorker);
    usageWorker = void 0;
    assert.deepEqual(await processUsageBatch(app.prisma, queuedJob), { accepted: 0 });

    const quota = await app.inject({
      method: "GET",
      url: "/v1/quota/check?provider=chatgpt&model=gpt-integration",
      headers: baseHeaders
    });
    assert.equal(quota.statusCode, 200);
    assert.equal(quota.json().usedTokens, 420);
    assert.equal(quota.json().remainingTokens, 99_580);
    assert.equal(quota.json().limited, false);
    assert.equal(quota.json().usageAccuracy, "estimated");
    assert.match(quota.json().usageBasis, /no provider billing counter/i);

    const quotaLoad = await Promise.all(Array.from({ length: 80 }, async () => {
      const startedAt = performance.now();
      const response = await app.inject({
        method: "GET",
        url: "/v1/quota/check?provider=chatgpt&model=gpt-integration",
        headers: baseHeaders
      });
      return { statusCode: response.statusCode, latencyMs: performance.now() - startedAt };
    }));
    assert.equal(quotaLoad.every((sample) => sample.statusCode === 200), true);
    const quotaP95 = quotaLoad.map((sample) => sample.latencyMs).sort((left, right) => left - right)[Math.floor(quotaLoad.length * 0.95)]!;
    assert.ok(quotaP95 < 5_000, `quota load p95 exceeded 5 seconds: ${quotaP95.toFixed(1)}ms`);
    context.diagnostic(`quota-load requests=80 p95=${quotaP95.toFixed(1)}ms`);

    await app.prisma.plan.update({ where: { id: "free" }, data: { monthlyTokenCap: 400 } });
    const exhaustedQuota = await app.inject({
      method: "GET",
      url: "/v1/quota/check?provider=chatgpt&model=gpt-integration",
      headers: baseHeaders
    });
    assert.equal(exhaustedQuota.statusCode, 200);
    assert.equal(exhaustedQuota.json().usedTokens, 420);
    assert.equal(exhaustedQuota.json().remainingTokens, 0);
    assert.equal(exhaustedQuota.json().limited, true);
    await app.prisma.plan.update({ where: { id: "free" }, data: { monthlyTokenCap: 100_000 } });

    const sync = await app.inject({
      method: "POST",
      url: "/v1/sync/state",
      headers: baseHeaders,
      payload: { includeUsage: true, maxEvents: 10 }
    });
    assert.equal(sync.statusCode, 200);
    assert.equal(sync.json().settings.version, 1);
    assert.equal(sync.json().usageEvents.length, 1);
    assert.equal(sync.json().usageEvents[0].clientEventId, "integration-event-0001");
    assert.equal(sync.json().usageEvents[0].measurementLevel, "approximation");
    assert.equal(sync.json().usageEvents[0].measurementMethod, "dom-text-heuristic");
    assert.equal(sync.json().usageEvents[0].confidence, 0.51);
    assert.equal(sync.json().usageEvents[0].userId, undefined);
    assert.equal(sync.json().usageEvents[0].deviceId, undefined);

    const otherSync = await app.inject({
      method: "POST",
      url: "/v1/sync/state",
      headers: { ...baseHeaders, authorization: `Bearer ${otherToken}`, "x-install-id": "integration-other-0001" },
      payload: { includeUsage: true, maxEvents: 10 }
    });
    assert.equal(otherSync.statusCode, 200);
    assert.equal(otherSync.json().settings, null);
    assert.deepEqual(otherSync.json().usageEvents, []);

    const diagnostics = await app.inject({
      method: "POST",
      url: "/v1/diagnostics/errors",
      headers: baseHeaders,
      payload: {
        source: "background",
        severity: "error",
        message: "Integration diagnostic",
        stack: "sensitive local stack text",
        context: { phase: "integration" }
      }
    });
    assert.equal(diagnostics.statusCode, 202);
    const storedDiagnostic = await app.prisma.errorLog.findFirst({
      where: { user: { authSubject }, message: "Integration diagnostic" }
    });
    assert.ok(storedDiagnostic);
    assert.equal(storedDiagnostic.stackHash?.length, 64);
    assert.equal(JSON.stringify(storedDiagnostic).includes("sensitive local stack text"), false);

    const metricsDenied = await app.inject({ method: "GET", url: "/metrics" });
    assert.equal(metricsDenied.statusCode, 401);
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer integration-metrics-token-24-bytes" }
    });
    assert.equal(metrics.statusCode, 200);
    assert.match(metrics.body, /yor_backend_process_cpu_user_seconds_total/);

    const secondDevice = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { ...baseHeaders, "x-install-id": "integration-install-0002" }
    });
    assert.equal(secondDevice.statusCode, 200);
    const thirdDevice = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { ...baseHeaders, "x-install-id": "integration-install-0003" }
    });
    assert.equal(thirdDevice.statusCode, 409);
    assert.equal(thirdDevice.json().error, "device_limit_reached");

    await app.prisma.plan.update({ where: { id: "free" }, data: { maxEventsPerDay: 3 } });
    const burstToken = await signToken(burstAuthSubject, "burst@example.com");
    const burstHeaders = {
      ...baseHeaders,
      authorization: `Bearer ${burstToken}`,
      "x-install-id": "integration-burst-install-0001"
    };
    const burstSession = await app.inject({ method: "GET", url: "/v1/auth/session", headers: burstHeaders });
    assert.equal(burstSession.statusCode, 200);
    const burstUserId = burstSession.json().user.id as string;
    const burstOccurredAt = new Date().toISOString();
    const burstPayloads = Array.from({ length: 10 }, (_, index) => ({
      events: [{
        clientEventId: `integration-burst-event-${index}`,
        provider: "chatgpt",
        model: "gpt-integration",
        occurredAt: burstOccurredAt,
        promptTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        status: "COMPLETED",
        accuracy: "ESTIMATED"
      }]
    }));
    const burstResponses = await Promise.all(burstPayloads.map((payload, index) => app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: { ...burstHeaders, "idempotency-key": `integration-burst-idempotency-${index}` },
      payload
    })));
    assert.equal(burstResponses.filter((response) => response.statusCode === 202).length, 3);
    assert.equal(burstResponses.filter((response) => response.statusCode === 429).length, 7);
    const acceptedBurstIndex = burstResponses.findIndex((response) => response.statusCode === 202);
    assert.ok(acceptedBurstIndex >= 0);
    const burstReplay = await app.inject({
      method: "POST",
      url: "/v1/usage/events/batch",
      headers: { ...burstHeaders, "idempotency-key": `integration-burst-idempotency-${acceptedBurstIndex}` },
      payload: burstPayloads[acceptedBurstIndex]
    });
    assert.equal(burstReplay.statusCode, 202);
    const dailyKey = `usage-stream:daily:${burstUserId}:${new Date().toISOString().slice(0, 10)}`;
    assert.equal(await app.redis.get(dailyKey), "3");
  } finally {
    await stopWorker(usageWorker).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await app.prisma.plan.updateMany({
      where: { id: "free" },
      data: { monthlyTokenCap: 100_000, maxEventsPerDay: 1_000 }
    }).catch(() => undefined);
    await app.prisma.user.deleteMany({
      where: { authSubject: { in: [authSubject, "integration-user-other", burstAuthSubject] } }
    }).catch(() => undefined);
    await app.redis.flushdb().catch(() => undefined);
    await app.close();
    jwksServer.closeAllConnections();
    await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  }
});
