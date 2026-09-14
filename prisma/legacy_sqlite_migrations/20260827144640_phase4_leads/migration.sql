-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "location" TEXT;
ALTER TABLE "Lead" ADD COLUMN "notes" TEXT;
ALTER TABLE "Lead" ADD COLUMN "phone" TEXT;
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "scoreType" TEXT DEFAULT 'RULE_BASED';
ALTER TABLE "Lead" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Lead_organizationId_createdAt_idx" ON "Lead"("organizationId", "createdAt");
