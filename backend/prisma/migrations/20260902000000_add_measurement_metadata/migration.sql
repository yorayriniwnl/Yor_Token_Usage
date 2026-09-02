-- Add explicit provenance for token measurements without changing legacy event identity.
CREATE TYPE "MeasurementLevel" AS ENUM ('AUTHORITATIVE', 'DETERMINISTIC', 'CALIBRATED_ESTIMATE', 'APPROXIMATION', 'UNKNOWN');

ALTER TABLE "usage_events"
    ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "measurement_method" TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN "measurement_level" "MeasurementLevel" NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "error_margin_percent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    ADD COLUMN "tokenizer" TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN "source" TEXT NOT NULL DEFAULT 'Legacy event without measurement metadata';

ALTER TABLE "usage_events"
    ADD CONSTRAINT "usage_events_schema_version_positive" CHECK ("schema_version" >= 1),
    ADD CONSTRAINT "usage_events_confidence_bounded" CHECK ("confidence" >= 0 AND "confidence" <= 1),
    ADD CONSTRAINT "usage_events_error_margin_nonnegative" CHECK ("error_margin_percent" >= 0);
