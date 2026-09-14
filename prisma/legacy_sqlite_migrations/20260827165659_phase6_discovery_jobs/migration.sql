-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscoveryJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "criteria" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscoveryResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryResult_discoveryJobId_fkey" FOREIGN KEY ("discoveryJobId") REFERENCES "DiscoveryJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscoveryResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProviderCredential_organizationId_idx" ON "ProviderCredential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCredential_organizationId_provider_key" ON "ProviderCredential"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "DiscoveryJob_organizationId_idx" ON "DiscoveryJob"("organizationId");

-- CreateIndex
CREATE INDEX "DiscoveryJob_organizationId_status_idx" ON "DiscoveryJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DiscoveryJob_organizationId_createdAt_idx" ON "DiscoveryJob"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryResult_organizationId_idx" ON "DiscoveryResult"("organizationId");

-- CreateIndex
CREATE INDEX "DiscoveryResult_discoveryJobId_idx" ON "DiscoveryResult"("discoveryJobId");
