-- CreateTable
CREATE TABLE "BusinessInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "metricName" TEXT,
    "currentValue" DOUBLE PRECISION,
    "baselineValue" DOUBLE PRECISION,
    "changePercentage" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveOutcomeAttribution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "decisionId" TEXT,
    "actionPlanId" TEXT,
    "pendingActionId" TEXT,
    "attributionStatus" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "targetMetric" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "expectedImpactValue" DOUBLE PRECISION,
    "actualDeltaValue" DOUBLE PRECISION,
    "attributionRationale" TEXT NOT NULL,
    "confoundingFactors" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveOutcomeAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInsight_fingerprint_key" ON "BusinessInsight"("fingerprint");

-- CreateIndex
CREATE INDEX "BusinessInsight_organizationId_status_idx" ON "BusinessInsight"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BusinessInsight_organizationId_severity_idx" ON "BusinessInsight"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "BusinessInsight_organizationId_createdAt_idx" ON "BusinessInsight"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveOutcomeAttribution_outcomeId_key" ON "ExecutiveOutcomeAttribution"("outcomeId");

-- CreateIndex
CREATE INDEX "ExecutiveOutcomeAttribution_organizationId_attributionStatus_idx" ON "ExecutiveOutcomeAttribution"("organizationId", "attributionStatus");

-- CreateIndex
CREATE INDEX "ExecutiveOutcomeAttribution_outcomeId_idx" ON "ExecutiveOutcomeAttribution"("outcomeId");

-- AddForeignKey
ALTER TABLE "BusinessInsight" ADD CONSTRAINT "BusinessInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveOutcomeAttribution" ADD CONSTRAINT "ExecutiveOutcomeAttribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveOutcomeAttribution" ADD CONSTRAINT "ExecutiveOutcomeAttribution_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "ExecutiveOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
