CREATE UNIQUE INDEX "team_memberships_one_active_per_user"
  ON "team_memberships" ("user_id")
  WHERE "left_at" IS NULL;

ALTER TABLE "budget_accounts"
  ADD CONSTRAINT "budget_accounts_owner_matches_reference"
  CHECK (
    ("owner_type" = 'USER' AND "user_id" IS NOT NULL AND "team_id" IS NULL)
    OR
    ("owner_type" = 'TEAM' AND "team_id" IS NOT NULL AND "user_id" IS NULL)
  );
