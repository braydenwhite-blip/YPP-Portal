-- Metrics tab editable rows (admin-managed).
CREATE TABLE IF NOT EXISTS "MetricsTrackerMetric" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "owner" TEXT NOT NULL DEFAULT '',
  "targetLabel" TEXT NOT NULL DEFAULT '',
  "monthlyTargets" JSONB NOT NULL,
  "targetDisplay" JSONB,
  "reset" TEXT NOT NULL DEFAULT 'monthly',
  "unit" TEXT NOT NULL DEFAULT 'count',
  "chart" TEXT NOT NULL DEFAULT 'line',
  "tracks" TEXT,
  "why" TEXT,
  "noTarget" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetricsTrackerMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetricsTrackerMetric_scope_categoryId_key_key"
  ON "MetricsTrackerMetric"("scope", "categoryId", "key");

CREATE INDEX IF NOT EXISTS "MetricsTrackerMetric_scope_categoryId_sortOrder_idx"
  ON "MetricsTrackerMetric"("scope", "categoryId", "sortOrder");

CREATE INDEX IF NOT EXISTS "MetricsTrackerMetric_archivedAt_idx"
  ON "MetricsTrackerMetric"("archivedAt");

DO $$ BEGIN
  ALTER TABLE "MetricsTrackerMetric"
    ADD CONSTRAINT "MetricsTrackerMetric_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
