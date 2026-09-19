ALTER TABLE "purchases" ADD COLUMN "renewed_from_id" UUID;
CREATE UNIQUE INDEX "purchases_renewed_from_id_key" ON "purchases"("renewed_from_id");
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

CREATE UNIQUE INDEX "renewal_requests_one_submitted_per_purchase_idx"
ON "renewal_requests"("purchase_id")
WHERE "status" = 'SUBMITTED';
