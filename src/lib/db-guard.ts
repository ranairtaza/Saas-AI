/**
 * LeadMachine Database Write Safety & Identity Gate (Phase 20)
 * 
 * Centralized server-only guard to prevent unintended database writes.
 * Enforces strict fail-closed semantics unless:
 * 1. LEADMACHINE_DB_WRITES_ENABLED is strictly 'true'
 * 2. LEADMACHINE_DATABASE_ID strictly matches the expected application identity ('leadmachine')
 * 3. Connected database passes identity verification (via _leadmachine_metadata table)
 */

export const EXPECTED_DATABASE_ID = 'leadmachine';
export const EXPECTED_APPLICATION = 'leadmachine';

export class DatabaseWriteBlockedError extends Error {
  constructor(message = 'Database write operation blocked: Writes are disabled or database identity does not match LeadMachine.') {
    super(message);
    this.name = 'DatabaseWriteBlockedError';
  }
}

export interface DatabaseWriteSafetyStatus {
  allowed: boolean;
  reason?: string;
  databaseId?: string;
  environment?: string;
}

export interface LeadMachineMetadata {
  id: string;
  application: string;
  environment: string;
  identity: string;
  created_at?: Date;
}

/**
 * Evaluates whether environment configuration permits database writes.
 * Strict fail-closed parsing: only exact 'true' allows writes.
 */
export function getDatabaseWriteSafetyStatus(): DatabaseWriteSafetyStatus {
  const writesEnabledRaw = process.env.LEADMACHINE_DB_WRITES_ENABLED;
  const dbIdRaw = process.env.LEADMACHINE_DATABASE_ID;
  const envRaw = process.env.LEADMACHINE_DB_ENVIRONMENT || process.env.NODE_ENV || 'development';

  // Strict boolean validation - must be exact string 'true'
  const isEnabled = writesEnabledRaw?.trim() === 'true';

  if (!isEnabled) {
    return {
      allowed: false,
      reason: 'Database writes are explicitly disabled or unconfigured (LEADMACHINE_DB_WRITES_ENABLED !== "true").',
    };
  }

  // Database identity validation
  const dbId = dbIdRaw?.trim();
  if (!dbId || dbId !== EXPECTED_DATABASE_ID) {
    return {
      allowed: false,
      reason: `Database identity validation failed. Expected "${EXPECTED_DATABASE_ID}".`,
    };
  }

  return {
    allowed: true,
    databaseId: dbId,
    environment: envRaw,
  };
}

/**
 * Boolean helper for checking write permissions.
 */
export function isDatabaseWritesAllowed(): boolean {
  return getDatabaseWriteSafetyStatus().allowed;
}

/**
 * Throws a DatabaseWriteBlockedError if database writes are not allowed.
 * Never leaks DATABASE_URL, passwords, hostnames, or credentials.
 */
export function assertDatabaseWritesAllowed(operation?: string): void {
  const status = getDatabaseWriteSafetyStatus();
  if (!status.allowed) {
    const detail = operation ? ` Operation "${operation}" blocked: ${status.reason}` : status.reason;
    throw new DatabaseWriteBlockedError(detail);
  }
}

/**
 * Actively verifies that the connected PostgreSQL database has the official
 * LeadMachine identity metadata table and record.
 * 
 * Fails closed if:
 * - Database query fails
 * - Table _leadmachine_metadata does not exist
 * - Application or identity does not match 'leadmachine'
 */
export async function verifyDatabaseIdentity(prismaClient: any): Promise<{
  verified: boolean;
  databaseName?: string;
  application?: string;
  environment?: string;
  error?: string;
}> {
  try {
    // 1. Check environment write gate first
    const envStatus = getDatabaseWriteSafetyStatus();
    if (!envStatus.allowed) {
      return {
        verified: false,
        error: envStatus.reason,
      };
    }

    // 2. Query active PostgreSQL database name (safe metadata only)
    const dbResult: any = await prismaClient.$queryRawUnsafe(`SELECT current_database() as db_name;`);
    const dbName = dbResult?.[0]?.db_name || 'unknown';

    // 3. Query LeadMachine metadata table
    const metaResult: any = await prismaClient.$queryRawUnsafe(
      `SELECT id, application, environment, identity FROM "_leadmachine_metadata" LIMIT 1;`
    );

    if (!metaResult || metaResult.length === 0) {
      return {
        verified: false,
        databaseName: dbName,
        error: 'Database identity verification failed: "_leadmachine_metadata" table is empty.',
      };
    }

    const meta = metaResult[0];
    if (meta.application !== EXPECTED_APPLICATION || meta.identity !== EXPECTED_DATABASE_ID) {
      return {
        verified: false,
        databaseName: dbName,
        error: `Database identity mismatch. Found application="${meta.application}", identity="${meta.identity}".`,
      };
    }

    return {
      verified: true,
      databaseName: dbName,
      application: meta.application,
      environment: meta.environment,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: `Database identity verification query failed: ${err.message || 'Table not found or connection rejected'}`,
    };
  }
}
