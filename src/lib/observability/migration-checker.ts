/**
 * Phase 48: Migration Consistency Checker
 * Inspects database migration records against the filesystem migrations
 * to detect pending, missing, or failed migrations without executing destructive commands.
 */

import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationCheckResult {
  status: 'SYNCHRONIZED' | 'PENDING' | 'INCONSISTENT' | 'UNKNOWN';
  appliedCount: number;
  expectedCount: number;
  appliedMigrations: string[];
  pendingMigrations: string[];
  failedMigrations: string[];
  details: string;
}

export async function checkMigrationConsistency(): Promise<MigrationCheckResult> {
  try {
    // 1. Get filesystem migrations
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    let filesystemMigrations: string[] = [];
    if (fs.existsSync(migrationsDir)) {
      filesystemMigrations = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'node_modules')
        .map((d) => d.name)
        .sort();
    }

    // 2. Query applied migrations from database
    const dbRows: Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }> = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at ASC
    `;

    const appliedMigrations = dbRows
      .filter((r) => r.finished_at !== null && r.rolled_back_at === null)
      .map((r) => r.migration_name);

    const failedMigrations = dbRows
      .filter((r) => r.finished_at === null || r.rolled_back_at !== null)
      .map((r) => r.migration_name);

    const pendingMigrations = filesystemMigrations.filter(
      (m) => !appliedMigrations.includes(m)
    );

    let status: 'SYNCHRONIZED' | 'PENDING' | 'INCONSISTENT' = 'SYNCHRONIZED';
    let details = 'Database migrations are fully synchronized with schema.';

    if (failedMigrations.length > 0) {
      status = 'INCONSISTENT';
      details = `Failed migration detected in database: ${failedMigrations.join(', ')}`;
    } else if (pendingMigrations.length > 0) {
      status = 'PENDING';
      details = `Pending migrations detected: ${pendingMigrations.join(', ')}`;
    } else if (appliedMigrations.length < filesystemMigrations.length) {
      status = 'INCONSISTENT';
      details = 'Fewer applied migrations than filesystem migrations.';
    }

    return {
      status,
      appliedCount: appliedMigrations.length,
      expectedCount: filesystemMigrations.length,
      appliedMigrations,
      pendingMigrations,
      failedMigrations,
      details,
    };
  } catch (error: any) {
    return {
      status: 'UNKNOWN',
      appliedCount: 0,
      expectedCount: 0,
      appliedMigrations: [],
      pendingMigrations: [],
      failedMigrations: [],
      details: `Could not verify migration table: ${error.message || String(error)}`,
    };
  }
}
