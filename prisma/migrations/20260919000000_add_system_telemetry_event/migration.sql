-- CreateTable
CREATE TABLE "SystemTelemetryEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "route" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "durationMs" DOUBLE PRECISION,
    "requestId" TEXT,
    "traceId" TEXT,
    "service" TEXT NOT NULL DEFAULT 'api',
    "message" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemTelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemTelemetryEvent_organizationId_createdAt_idx" ON "SystemTelemetryEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemTelemetryEvent_statusCode_createdAt_idx" ON "SystemTelemetryEvent"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "SystemTelemetryEvent_route_createdAt_idx" ON "SystemTelemetryEvent"("route", "createdAt");

-- CreateIndex
CREATE INDEX "SystemTelemetryEvent_severity_createdAt_idx" ON "SystemTelemetryEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "SystemTelemetryEvent_eventType_createdAt_idx" ON "SystemTelemetryEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "SystemTelemetryEvent" ADD CONSTRAINT "SystemTelemetryEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
