-- CreateTable
CREATE TABLE "ExecutiveActionPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decisionId" TEXT,
    "forecastId" TEXT,
    "learningSignalId" TEXT,
    "actionType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyNow" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '[]',
    "expectedImpact" TEXT NOT NULL,
    "expectedMetricChange" DOUBLE PRECISION,
    "targetMetric" TEXT,
    "timeHorizon" TEXT NOT NULL,
    "expectedCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "governanceVerdict" TEXT NOT NULL,
    "governanceExplanation" TEXT NOT NULL,
    "requiredAuthority" TEXT NOT NULL DEFAULT 'MANAGER',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "idempotencyKey" TEXT NOT NULL,
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "actionPayload" TEXT,
    "pendingActionId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveActionPlan_idempotencyKey_key" ON "ExecutiveActionPlan"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExecutiveActionPlan_organizationId_status_idx" ON "ExecutiveActionPlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ExecutiveActionPlan_organizationId_priority_idx" ON "ExecutiveActionPlan"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "ExecutiveActionPlan_organizationId_domain_idx" ON "ExecutiveActionPlan"("organizationId", "domain");

-- CreateIndex
CREATE INDEX "ExecutiveActionPlan_organizationId_createdAt_idx" ON "ExecutiveActionPlan"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExecutiveActionPlan" ADD CONSTRAINT "ExecutiveActionPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
