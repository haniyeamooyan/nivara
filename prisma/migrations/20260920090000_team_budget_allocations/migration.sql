CREATE TYPE "TeamBudgetAllocationStatus" AS ENUM ('DRAFT', 'CONFIRMED');

CREATE TABLE "team_budget_allocations" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "default_amount" DECIMAL(12,2) NOT NULL,
    "status" "TeamBudgetAllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_budget_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_periods_starts_at_key" ON "budget_periods"("starts_at");
CREATE UNIQUE INDEX "team_budget_allocations_period_id_team_id_key" ON "team_budget_allocations"("period_id", "team_id");
CREATE INDEX "team_budget_allocations_team_id_status_idx" ON "team_budget_allocations"("team_id", "status");

ALTER TABLE "budget_allocations"
  ADD COLUMN "carried_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "team_budget_allocation_id" UUID;

ALTER TABLE "budget_allocations"
  ALTER COLUMN "confirmed_by" DROP NOT NULL,
  ALTER COLUMN "confirmed_at" DROP NOT NULL;

INSERT INTO "team_budget_allocations" (
    "id", "period_id", "team_id", "default_amount", "status",
    "confirmed_by", "confirmed_at", "created_at", "updated_at"
)
SELECT
    md5(grouped."period_id"::text || grouped."team_id"::text)::uuid,
    grouped."period_id",
    grouped."team_id",
    MAX(grouped."amount"),
    CASE WHEN BOOL_AND(grouped."confirmed_at" IS NOT NULL) THEN 'CONFIRMED'::"TeamBudgetAllocationStatus" ELSE 'DRAFT'::"TeamBudgetAllocationStatus" END,
    (ARRAY_AGG(grouped."confirmed_by"))[1],
    MAX(grouped."confirmed_at"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "budget_allocations" AS grouped
GROUP BY grouped."period_id", grouped."team_id";

UPDATE "budget_allocations" AS allocation
SET "team_budget_allocation_id" = team_allocation."id"
FROM "team_budget_allocations" AS team_allocation
WHERE allocation."period_id" = team_allocation."period_id"
  AND allocation."team_id" = team_allocation."team_id";

ALTER TABLE "budget_allocations"
  ALTER COLUMN "team_budget_allocation_id" SET NOT NULL;

ALTER TABLE "team_budget_allocations"
  ADD CONSTRAINT "team_budget_allocations_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "budget_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "team_budget_allocations_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "team_budget_allocations_confirmed_by_fkey"
    FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "budget_allocations"
  ADD CONSTRAINT "budget_allocations_team_budget_allocation_id_fkey"
    FOREIGN KEY ("team_budget_allocation_id") REFERENCES "team_budget_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
