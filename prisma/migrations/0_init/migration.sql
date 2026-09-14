-- LeadMachine Dedicated PostgreSQL Baseline Migration (0_init)
-- Authoritative Schema Contract (Phases 1-20)

-- ========================================================
-- 0. LeadMachine Database Identity Metadata
-- ========================================================
CREATE TABLE IF NOT EXISTS "_leadmachine_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application" TEXT NOT NULL DEFAULT 'leadmachine',
    "environment" TEXT NOT NULL DEFAULT 'production',
    "identity" TEXT NOT NULL DEFAULT 'leadmachine',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "_leadmachine_metadata" ("id", "application", "environment", "identity")
VALUES ('leadmachine-primary-identity', 'leadmachine', 'production', 'leadmachine')
ON CONFLICT ("id") DO NOTHING;

-- ========================================================
-- 1. Core Tenant & Authentication Tables
-- ========================================================
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiCredits" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT,
    "industry" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "localeCode" TEXT NOT NULL DEFAULT 'en-US',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 2. CRM & Lead Management Tables
-- ========================================================
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "domain" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactTitle" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "enrichmentData" TEXT,
    "score" INTEGER,
    "scoreType" TEXT DEFAULT 'RULE_BASED',
    "aiScore" INTEGER,
    "aiSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 3. Lead Discovery Engine Tables
-- ========================================================
CREATE TABLE "DiscoveryJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "criteria" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryResult" (
    "id" TEXT NOT NULL,
    "discoveryJobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT,
    "companyName" TEXT NOT NULL,
    "domain" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactTitle" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "metadata" TEXT,
    "score" INTEGER,
    "verificationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryResult_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 4. Billing & Credit Tables
-- ========================================================
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" INTEGER NOT NULL,
    "monthlyCredits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceId" TEXT,
    "features" TEXT,
    "limits" TEXT,
    "billingInterval" TEXT NOT NULL DEFAULT 'monthly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationBilling" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBilling_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "reservedBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeGranted" INTEGER NOT NULL DEFAULT 0,
    "lifetimeConsumed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "discoveryJobId" TEXT,
    "provider" TEXT,
    "operation" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 5. AI Action Engine & Audit Tables
-- ========================================================
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "conversationId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "input" TEXT,
    "output" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCall" TEXT,
    "toolResult" TEXT,
    "audioUrl" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "approvingUserId" TEXT,
    "conversationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionArgs" TEXT NOT NULL,
    "humanDescription" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "executionResult" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 6. Business Data Layer Tables (Phase 17)
-- ========================================================
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "industry" TEXT,
    "businessName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- 7. Unique Constraints & Indexes
-- ========================================================
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "ProviderCredential_organizationId_provider_key" ON "ProviderCredential"("organizationId", "provider");
CREATE INDEX "ProviderCredential_organizationId_idx" ON "ProviderCredential"("organizationId");

CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");
CREATE INDEX "Lead_organizationId_createdAt_idx" ON "Lead"("organizationId", "createdAt");
CREATE INDEX "Lead_organizationId_ownerId_idx" ON "Lead"("organizationId", "ownerId");

CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_organizationId_createdAt_idx" ON "LeadActivity"("organizationId", "createdAt");

CREATE INDEX "DiscoveryJob_organizationId_idx" ON "DiscoveryJob"("organizationId");
CREATE INDEX "DiscoveryJob_organizationId_status_idx" ON "DiscoveryJob"("organizationId", "status");
CREATE INDEX "DiscoveryJob_organizationId_createdAt_idx" ON "DiscoveryJob"("organizationId", "createdAt");

CREATE INDEX "DiscoveryResult_organizationId_idx" ON "DiscoveryResult"("organizationId");
CREATE INDEX "DiscoveryResult_discoveryJobId_idx" ON "DiscoveryResult"("discoveryJobId");

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "Plan"("stripePriceId");

CREATE UNIQUE INDEX "OrganizationBilling_organizationId_key" ON "OrganizationBilling"("organizationId");
CREATE UNIQUE INDEX "OrganizationBilling_stripeCustomerId_key" ON "OrganizationBilling"("stripeCustomerId");
CREATE UNIQUE INDEX "OrganizationBilling_stripeSubscriptionId_key" ON "OrganizationBilling"("stripeSubscriptionId");
CREATE INDEX "OrganizationBilling_stripeCustomerId_idx" ON "OrganizationBilling"("stripeCustomerId");
CREATE INDEX "OrganizationBilling_stripeSubscriptionId_idx" ON "OrganizationBilling"("stripeSubscriptionId");

CREATE UNIQUE INDEX "CreditAccount_organizationId_key" ON "CreditAccount"("organizationId");

CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_organizationId_idx" ON "CreditTransaction"("organizationId");
CREATE INDEX "CreditTransaction_referenceType_referenceId_idx" ON "CreditTransaction"("referenceType", "referenceId");

CREATE INDEX "UsageRecord_organizationId_idx" ON "UsageRecord"("organizationId");
CREATE INDEX "UsageRecord_discoveryJobId_idx" ON "UsageRecord"("discoveryJobId");

CREATE UNIQUE INDEX "WebhookEvent_stripeEventId_key" ON "WebhookEvent"("stripeEventId");

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

CREATE INDEX "Conversation_organizationId_userId_idx" ON "Conversation"("organizationId", "userId");

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

CREATE UNIQUE INDEX "PendingAction_idempotencyKey_key" ON "PendingAction"("idempotencyKey");
CREATE INDEX "PendingAction_organizationId_status_idx" ON "PendingAction"("organizationId", "status");
CREATE INDEX "PendingAction_conversationId_status_idx" ON "PendingAction"("conversationId", "status");

CREATE INDEX "AIUsageRecord_organizationId_createdAt_idx" ON "AIUsageRecord"("organizationId", "createdAt");

CREATE UNIQUE INDEX "BusinessProfile_organizationId_key" ON "BusinessProfile"("organizationId");
CREATE INDEX "BusinessProfile_organizationId_idx" ON "BusinessProfile"("organizationId");

CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");

CREATE UNIQUE INDEX "IntegrationConnection_organizationId_integrationId_key" ON "IntegrationConnection"("organizationId", "integrationId");
CREATE INDEX "IntegrationConnection_organizationId_idx" ON "IntegrationConnection"("organizationId");

CREATE INDEX "SyncJob_organizationId_idx" ON "SyncJob"("organizationId");
CREATE INDEX "SyncJob_integrationConnectionId_idx" ON "SyncJob"("integrationConnectionId");
CREATE INDEX "SyncJob_organizationId_status_idx" ON "SyncJob"("organizationId", "status");

CREATE UNIQUE INDEX "BusinessMetric_organizationId_key_key" ON "BusinessMetric"("organizationId", "key");
CREATE INDEX "BusinessMetric_organizationId_idx" ON "BusinessMetric"("organizationId");

CREATE INDEX "MetricSnapshot_organizationId_timestamp_idx" ON "MetricSnapshot"("organizationId", "timestamp");
CREATE INDEX "MetricSnapshot_organizationId_metricId_timestamp_idx" ON "MetricSnapshot"("organizationId", "metricId", "timestamp");

-- ========================================================
-- 8. Foreign Key Constraints
-- ========================================================
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscoveryJob" ADD CONSTRAINT "DiscoveryJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscoveryResult" ADD CONSTRAINT "DiscoveryResult_discoveryJobId_fkey" FOREIGN KEY ("discoveryJobId") REFERENCES "DiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryResult" ADD CONSTRAINT "DiscoveryResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationBilling" ADD CONSTRAINT "OrganizationBilling_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationBilling" ADD CONSTRAINT "OrganizationBilling_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "BusinessMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 21 OutreachDraft
CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'CONSULTATIVE_VALUE',
    "intelligence" TEXT NOT NULL,
    "generationMode" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "pendingActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutreachDraft_pendingActionId_key" ON "OutreachDraft"("pendingActionId");
CREATE INDEX "OutreachDraft_organizationId_leadId_idx" ON "OutreachDraft"("organizationId", "leadId");
CREATE INDEX "OutreachDraft_organizationId_status_idx" ON "OutreachDraft"("organizationId", "status");
CREATE INDEX "OutreachDraft_contextHash_idx" ON "OutreachDraft"("contextHash");

ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 22 EnrichmentRun & EnrichmentEvidence
CREATE TABLE "EnrichmentRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "providersRequested" TEXT NOT NULL,
    "providersCompleted" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "EnrichmentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnrichmentEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "provider" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EnrichmentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrichmentRun_organizationId_leadId_idx" ON "EnrichmentRun"("organizationId", "leadId");
CREATE INDEX "EnrichmentRun_organizationId_status_idx" ON "EnrichmentRun"("organizationId", "status");

CREATE INDEX "EnrichmentEvidence_organizationId_leadId_idx" ON "EnrichmentEvidence"("organizationId", "leadId");
CREATE INDEX "EnrichmentEvidence_runId_idx" ON "EnrichmentEvidence"("runId");
CREATE INDEX "EnrichmentEvidence_field_idx" ON "EnrichmentEvidence"("field");

ALTER TABLE "EnrichmentRun" ADD CONSTRAINT "EnrichmentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrichmentRun" ADD CONSTRAINT "EnrichmentRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrichmentRun" ADD CONSTRAINT "EnrichmentRun_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrichmentEvidence" ADD CONSTRAINT "EnrichmentEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrichmentEvidence" ADD CONSTRAINT "EnrichmentEvidence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrichmentEvidence" ADD CONSTRAINT "EnrichmentEvidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EnrichmentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 23 AI Business Executive Models
CREATE TABLE "BusinessGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kpiKey" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveMemoryEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "observations" TEXT NOT NULL,
    "outcome" TEXT,
    "sourceActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveMemoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'REVENUE',
    "priorityScore" INTEGER NOT NULL,
    "priorityLevel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "actionProposal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pendingActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ExecutiveRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessGoal_organizationId_status_idx" ON "BusinessGoal"("organizationId", "status");
CREATE INDEX "BusinessGoal_organizationId_kpiKey_idx" ON "BusinessGoal"("organizationId", "kpiKey");

CREATE INDEX "ExecutiveMemoryEntry_organizationId_category_idx" ON "ExecutiveMemoryEntry"("organizationId", "category");
CREATE INDEX "ExecutiveMemoryEntry_organizationId_createdAt_idx" ON "ExecutiveMemoryEntry"("organizationId", "createdAt");

CREATE UNIQUE INDEX "ExecutiveRecommendation_pendingActionId_key" ON "ExecutiveRecommendation"("pendingActionId");
CREATE INDEX "ExecutiveRecommendation_organizationId_status_idx" ON "ExecutiveRecommendation"("organizationId", "status");
CREATE INDEX "ExecutiveRecommendation_organizationId_priorityLevel_idx" ON "ExecutiveRecommendation"("organizationId", "priorityLevel");
CREATE INDEX "ExecutiveRecommendation_organizationId_createdAt_idx" ON "ExecutiveRecommendation"("organizationId", "createdAt");

ALTER TABLE "BusinessGoal" ADD CONSTRAINT "BusinessGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveMemoryEntry" ADD CONSTRAINT "ExecutiveMemoryEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveRecommendation" ADD CONSTRAINT "ExecutiveRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- PHASE 24 AI BUSINESS EXECUTIVE: PROACTIVE OBSERVATION & BRIEFING ---

CREATE TABLE "ExecutiveEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "facts" TEXT NOT NULL,
    "metadata" TEXT,
    "fingerprint" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutiveEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveBriefingRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "healthSummary" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "topPriorities" TEXT NOT NULL,
    "keyChanges" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "opportunities" TEXT NOT NULL,
    "recommendedActions" TEXT NOT NULL,
    "supportingFacts" TEXT NOT NULL,
    "observations" TEXT,
    "hypotheses" TEXT,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveBriefingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutiveEvent_organizationId_occurredAt_idx" ON "ExecutiveEvent"("organizationId", "occurredAt");
CREATE INDEX "ExecutiveEvent_organizationId_eventType_idx" ON "ExecutiveEvent"("organizationId", "eventType");
CREATE INDEX "ExecutiveEvent_organizationId_processed_idx" ON "ExecutiveEvent"("organizationId", "processed");
CREATE INDEX "ExecutiveEvent_organizationId_severity_idx" ON "ExecutiveEvent"("organizationId", "severity");
CREATE INDEX "ExecutiveEvent_organizationId_fingerprint_idx" ON "ExecutiveEvent"("organizationId", "fingerprint");

CREATE INDEX "ExecutiveBriefingRecord_organizationId_createdAt_idx" ON "ExecutiveBriefingRecord"("organizationId", "createdAt");

ALTER TABLE "ExecutiveEvent" ADD CONSTRAINT "ExecutiveEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveBriefingRecord" ADD CONSTRAINT "ExecutiveBriefingRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- PHASE 25 AI BUSINESS EXECUTIVE: OUTCOME INTELLIGENCE & LEARNING LOOP ---

CREATE TABLE "ExecutiveOutcome" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "pendingActionId" TEXT,
    "domain" TEXT NOT NULL,
    "targetKpiKey" TEXT,
    "targetGoalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MEASURING',
    "measurementWindowDays" INTEGER NOT NULL DEFAULT 7,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationDueAt" TIMESTAMP(3) NOT NULL,
    "evaluatedAt" TIMESTAMP(3),
    "beforeSnapshot" TEXT NOT NULL,
    "afterSnapshot" TEXT,
    "decisionId" TEXT,
    "expectedValue" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,
    "variancePercentage" DOUBLE PRECISION,
    "varianceStatus" TEXT,
    "confidence" TEXT,
    "effectivenessStatus" TEXT,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "finalValue" DOUBLE PRECISION,
    "deltaValue" DOUBLE PRECISION,
    "deltaPercentage" DOUBLE PRECISION,
    "healthScoreDelta" INTEGER,
    "resultStatus" TEXT,
    "attributionLevel" TEXT,
    "attributionRationale" TEXT,
    "hypothesisStatus" TEXT,
    "falsified" BOOLEAN NOT NULL DEFAULT false,

    "effectivenessScore" INTEGER,
    "executiveMemoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutiveOutcome_recommendationId_key" ON "ExecutiveOutcome"("recommendationId");
CREATE UNIQUE INDEX "ExecutiveOutcome_pendingActionId_key" ON "ExecutiveOutcome"("pendingActionId");
CREATE UNIQUE INDEX "ExecutiveOutcome_executiveMemoryId_key" ON "ExecutiveOutcome"("executiveMemoryId");

CREATE INDEX "ExecutiveOutcome_organizationId_status_idx" ON "ExecutiveOutcome"("organizationId", "status");
CREATE INDEX "ExecutiveOutcome_organizationId_resultStatus_idx" ON "ExecutiveOutcome"("organizationId", "resultStatus");
CREATE INDEX "ExecutiveOutcome_organizationId_evaluationDueAt_idx" ON "ExecutiveOutcome"("organizationId", "evaluationDueAt");
CREATE INDEX "ExecutiveOutcome_organizationId_domain_idx" ON "ExecutiveOutcome"("organizationId", "domain");

ALTER TABLE "ExecutiveOutcome" ADD CONSTRAINT "ExecutiveOutcome_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveOutcome" ADD CONSTRAINT "ExecutiveOutcome_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ExecutiveRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveOutcome" ADD CONSTRAINT "ExecutiveOutcome_pendingActionId_fkey" FOREIGN KEY ("pendingActionId") REFERENCES "PendingAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveOutcome" ADD CONSTRAINT "ExecutiveOutcome_targetGoalId_fkey" FOREIGN KEY ("targetGoalId") REFERENCES "BusinessGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveOutcome" ADD CONSTRAINT "ExecutiveOutcome_executiveMemoryId_fkey" FOREIGN KEY ("executiveMemoryId") REFERENCES "ExecutiveMemoryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- PHASE 27 AI BUSINESS EXECUTIVE: GOVERNANCE & POLICY ENGINE ---

CREATE TABLE "ExecutiveGovernancePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "riskTolerance" TEXT NOT NULL DEFAULT 'MEDIUM',
    "maxFinancialExposure" DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
    "maxLeadCapacityPerRep" INTEGER NOT NULL DEFAULT 50,
    "restrictedDomains" TEXT NOT NULL DEFAULT '[]',
    "restrictedActions" TEXT NOT NULL DEFAULT '[]',
    "minEvidenceConfidence" INTEGER NOT NULL DEFAULT 70,
    "requireExecutiveApprovalAboveRisk" TEXT NOT NULL DEFAULT 'HIGH',
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveGovernancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutiveGovernancePolicy_organizationId_key" ON "ExecutiveGovernancePolicy"("organizationId");
CREATE INDEX "ExecutiveGovernancePolicy_organizationId_idx" ON "ExecutiveGovernancePolicy"("organizationId");

ALTER TABLE "ExecutiveGovernancePolicy" ADD CONSTRAINT "ExecutiveGovernancePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- PHASE 28 AI BUSINESS EXECUTIVE: DECISION & APPROVAL ORCHESTRATION ---

CREATE TABLE "ExecutiveDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "strategyId" TEXT,
    "recommendationId" TEXT,
    "pendingActionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "requiredAuthority" TEXT NOT NULL DEFAULT 'MANAGER',
    "governanceVerdict" TEXT NOT NULL,
    "governanceExplanation" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "financialExposure" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidenceConfidence" INTEGER NOT NULL DEFAULT 0,
    "requestedByUserId" TEXT,
    "decidedByUserId" TEXT,
    "decisionReason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ExecutiveDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveDecisionAudit" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveDecisionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutiveDecision_organizationId_status_idx" ON "ExecutiveDecision"("organizationId", "status");
CREATE INDEX "ExecutiveDecision_organizationId_priority_idx" ON "ExecutiveDecision"("organizationId", "priority");
CREATE INDEX "ExecutiveDecision_organizationId_requiredAuthority_idx" ON "ExecutiveDecision"("organizationId", "requiredAuthority");
CREATE INDEX "ExecutiveDecision_organizationId_createdAt_idx" ON "ExecutiveDecision"("organizationId", "createdAt");

CREATE INDEX "ExecutiveDecisionAudit_decisionId_createdAt_idx" ON "ExecutiveDecisionAudit"("decisionId", "createdAt");
CREATE INDEX "ExecutiveDecisionAudit_organizationId_createdAt_idx" ON "ExecutiveDecisionAudit"("organizationId", "createdAt");

ALTER TABLE "ExecutiveDecision" ADD CONSTRAINT "ExecutiveDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveDecisionAudit" ADD CONSTRAINT "ExecutiveDecisionAudit_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ExecutiveDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- PHASE 29 AI BUSINESS EXECUTIVE: LEARNING SIGNALS & HISTORICAL INTELLIGENCE ---

CREATE TABLE "ExecutiveLearningSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decisionId" TEXT,
    "outcomeId" TEXT,
    "domain" TEXT NOT NULL,
    "strategyKey" TEXT,
    "metric" TEXT NOT NULL,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION NOT NULL,
    "variancePercentage" DOUBLE PRECISION NOT NULL,
    "varianceStatus" TEXT NOT NULL,
    "effectiveness" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "hypothesisResult" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveLearningSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutiveLearningSignal_organizationId_domain_idx" ON "ExecutiveLearningSignal"("organizationId", "domain");
CREATE INDEX "ExecutiveLearningSignal_organizationId_varianceStatus_idx" ON "ExecutiveLearningSignal"("organizationId", "varianceStatus");
CREATE INDEX "ExecutiveLearningSignal_organizationId_effectiveness_idx" ON "ExecutiveLearningSignal"("organizationId", "effectiveness");
CREATE INDEX "ExecutiveLearningSignal_organizationId_createdAt_idx" ON "ExecutiveLearningSignal"("organizationId", "createdAt");

ALTER TABLE "ExecutiveLearningSignal" ADD CONSTRAINT "ExecutiveLearningSignal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- PHASE 30 AI BUSINESS EXECUTIVE: PREDICTIVE INTELLIGENCE & FORECASTING ---

CREATE TABLE "ExecutiveForecast" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "domain" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "forecastValue" DOUBLE PRECISION NOT NULL,
    "forecastHorizon" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL DEFAULT 30,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL DEFAULT 'BASELINE',
    "evidence" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "riskSignals" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveForecast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutiveForecast_organizationId_domain_idx" ON "ExecutiveForecast"("organizationId", "domain");
CREATE INDEX "ExecutiveForecast_organizationId_metric_idx" ON "ExecutiveForecast"("organizationId", "metric");
CREATE INDEX "ExecutiveForecast_organizationId_forecastHorizon_idx" ON "ExecutiveForecast"("organizationId", "forecastHorizon");
CREATE INDEX "ExecutiveForecast_organizationId_confidence_idx" ON "ExecutiveForecast"("organizationId", "confidence");
CREATE INDEX "ExecutiveForecast_organizationId_createdAt_idx" ON "ExecutiveForecast"("organizationId", "createdAt");

ALTER TABLE "ExecutiveForecast" ADD CONSTRAINT "ExecutiveForecast_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;





