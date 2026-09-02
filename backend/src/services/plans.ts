import type { PrismaClient } from "@prisma/client";

type PlanLookupClient = Pick<PrismaClient, "plan" | "subscription">;

export class PlanUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = "plan_unavailable";

  constructor() {
    super("No FREE plan is configured for this account");
    this.name = "PlanUnavailableError";
  }
}

export async function resolveEntitlement(client: PlanLookupClient, userId: string) {
  const subscription = await client.subscription.findFirst({
    where: {
      userId,
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] }
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });
  const plan = subscription?.plan ?? await client.plan.findFirst({
    where: { tier: "FREE" },
    orderBy: { createdAt: "asc" }
  });

  return { plan, subscription };
}
