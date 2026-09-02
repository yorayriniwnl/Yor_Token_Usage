-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "UsageEventStatus" AS ENUM ('COMPLETED', 'RATE_LIMITED', 'FAILED');

-- CreateEnum
CREATE TYPE "Accuracy" AS ENUM ('ESTIMATED', 'EXACT', 'INFERRED');

-- CreateEnum
CREATE TYPE "QuotaWindowStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ApiLogStatus" AS ENUM ('OK', 'ERROR', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_installs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "install_id" TEXT NOT NULL,
    "extension_id" TEXT NOT NULL,
    "extension_ver" TEXT,
    "browser" TEXT,
    "platform" TEXT,
    "device_name" TEXT,
    "fingerprint_hash" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "client_event_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "thread_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "prompt_hash" TEXT,
    "status" "UsageEventStatus" NOT NULL DEFAULT 'COMPLETED',
    "accuracy" "Accuracy" NOT NULL DEFAULT 'ESTIMATED',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_windows" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "used_tokens" INTEGER NOT NULL DEFAULT 0,
    "prompt_count" INTEGER NOT NULL DEFAULT 0,
    "status" "QuotaWindowStatus" NOT NULL DEFAULT 'OPEN',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_token_cap" INTEGER NOT NULL,
    "max_devices" INTEGER NOT NULL,
    "max_events_per_day" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "provider_customer_id" TEXT,
    "provider_sub_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_secrets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "key_id" TEXT NOT NULL,
    "nonce" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_request_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "request_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "status" "ApiLogStatus" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack_hash" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response" JSONB,
    "status_code" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

-- CreateIndex
CREATE INDEX "extension_installs_user_id_status_last_seen_at_idx" ON "extension_installs"("user_id", "status", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "extension_installs_user_id_install_id_key" ON "extension_installs"("user_id", "install_id");

-- CreateIndex
CREATE INDEX "usage_events_user_id_occurred_at_idx" ON "usage_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_device_id_occurred_at_idx" ON "usage_events"("device_id", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_events_user_id_provider_model_occurred_at_idx" ON "usage_events"("user_id", "provider", "model", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_user_id_client_event_id_key" ON "usage_events"("user_id", "client_event_id");

-- CreateIndex
CREATE INDEX "quota_windows_user_id_window_start_window_end_idx" ON "quota_windows"("user_id", "window_start", "window_end");

-- CreateIndex
CREATE UNIQUE INDEX "quota_windows_user_id_provider_model_window_start_key" ON "quota_windows"("user_id", "provider", "model", "window_start");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_provider_customer_id_idx" ON "subscriptions"("provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_secrets_user_id_name_key" ON "user_secrets"("user_id", "name");

-- CreateIndex
CREATE INDEX "api_request_logs_user_id_created_at_idx" ON "api_request_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "api_request_logs_route_created_at_idx" ON "api_request_logs"("route", "created_at");

-- CreateIndex
CREATE INDEX "error_logs_user_id_created_at_idx" ON "error_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "error_logs_source_severity_created_at_idx" ON "error_logs"("source", "severity", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_route_key_key" ON "idempotency_keys"("user_id", "route", "key");

-- AddForeignKey
ALTER TABLE "extension_installs" ADD CONSTRAINT "extension_installs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "extension_installs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_windows" ADD CONSTRAINT "quota_windows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_secrets" ADD CONSTRAINT "user_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "extension_installs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "extension_installs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "extension_installs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add database-level guards for values that must remain non-negative even if a
-- future writer bypasses the API schemas.
ALTER TABLE "plans"
    ADD CONSTRAINT "plans_monthly_token_cap_nonnegative" CHECK ("monthly_token_cap" >= 0),
    ADD CONSTRAINT "plans_max_devices_positive" CHECK ("max_devices" >= 1),
    ADD CONSTRAINT "plans_max_events_per_day_positive" CHECK ("max_events_per_day" >= 1);

ALTER TABLE "usage_events"
    ADD CONSTRAINT "usage_events_prompt_tokens_nonnegative" CHECK ("prompt_tokens" >= 0),
    ADD CONSTRAINT "usage_events_output_tokens_nonnegative" CHECK ("output_tokens" >= 0),
    ADD CONSTRAINT "usage_events_total_tokens_nonnegative" CHECK ("total_tokens" >= 0),
    ADD CONSTRAINT "usage_events_total_tokens_consistent" CHECK ("total_tokens" >= "prompt_tokens" + "output_tokens");

ALTER TABLE "quota_windows"
    ADD CONSTRAINT "quota_windows_used_tokens_nonnegative" CHECK ("used_tokens" >= 0),
    ADD CONSTRAINT "quota_windows_prompt_count_nonnegative" CHECK ("prompt_count" >= 0),
    ADD CONSTRAINT "quota_windows_window_ordered" CHECK ("window_end" > "window_start");
