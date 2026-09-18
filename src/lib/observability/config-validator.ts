/**
 * Phase 47: Production Configuration Health Service
 * Verifies presence, format, and readiness of environment variables without leaking secrets.
 */

export type ConfigStatus = 'CONFIGURED' | 'MISSING' | 'INVALID' | 'NOT_REQUIRED';

export interface ConfigCheckResult {
  key: string;
  category: 'DATABASE' | 'SECURITY' | 'AI' | 'BILLING' | 'ASYNC_JOBS' | 'CACHE' | 'SYSTEM';
  required: boolean;
  status: ConfigStatus;
  description: string;
  details?: string;
}

export function validateSystemConfig(): ConfigCheckResult[] {
  const env = process.env;
  const isProd = env.NODE_ENV === 'production';

  const checks: ConfigCheckResult[] = [
    {
      key: 'DATABASE_URL',
      category: 'DATABASE',
      required: true,
      description: 'Primary PostgreSQL pooled/direct connection URL',
      status: !env.DATABASE_URL
        ? 'MISSING'
        : env.DATABASE_URL.startsWith('postgres://') || env.DATABASE_URL.startsWith('postgresql://')
        ? 'CONFIGURED'
        : 'INVALID',
    },
    {
      key: 'DIRECT_URL',
      category: 'DATABASE',
      required: true,
      description: 'Direct unpooled connection URL for migrations and DDL',
      status: !env.DIRECT_URL
        ? 'MISSING'
        : env.DIRECT_URL.startsWith('postgres://') || env.DIRECT_URL.startsWith('postgresql://')
        ? 'CONFIGURED'
        : 'INVALID',
    },
    {
      key: 'SESSION_SECRET',
      category: 'SECURITY',
      required: true,
      description: 'HMAC encryption secret for session tokens',
      status: !env.SESSION_SECRET
        ? 'MISSING'
        : env.SESSION_SECRET.length >= 32
        ? 'CONFIGURED'
        : 'INVALID',
      details: env.SESSION_SECRET && env.SESSION_SECRET.length < 32 ? 'Must be >= 32 chars' : undefined,
    },
    {
      key: 'PROVIDER_ENCRYPTION_KEY',
      category: 'SECURITY',
      required: true,
      description: 'AES-256 key for encrypted provider credentials',
      status: !env.PROVIDER_ENCRYPTION_KEY
        ? 'MISSING'
        : env.PROVIDER_ENCRYPTION_KEY.length >= 32
        ? 'CONFIGURED'
        : 'INVALID',
      details: env.PROVIDER_ENCRYPTION_KEY && env.PROVIDER_ENCRYPTION_KEY.length < 32 ? 'Must be >= 32 chars' : undefined,
    },
    {
      key: 'INTERNAL_JOB_SECRET',
      category: 'ASYNC_JOBS',
      required: isProd,
      description: 'Authentication token for internal scheduler & sync jobs',
      status: !env.INTERNAL_JOB_SECRET ? (isProd ? 'MISSING' : 'NOT_REQUIRED') : 'CONFIGURED',
    },
    {
      key: 'STRIPE_SECRET_KEY',
      category: 'BILLING',
      required: isProd,
      description: 'Stripe secret key for payment processing',
      status: !env.STRIPE_SECRET_KEY
        ? (isProd ? 'MISSING' : 'NOT_REQUIRED')
        : env.STRIPE_SECRET_KEY.startsWith('sk_') || env.STRIPE_SECRET_KEY.startsWith('rk_')
        ? 'CONFIGURED'
        : 'INVALID',
    },
    {
      key: 'GOOGLE_GENERATIVE_AI_API_KEY',
      category: 'AI',
      required: true,
      description: 'Gemini API key for executive intelligence and briefing engine',
      status: !env.GOOGLE_GENERATIVE_AI_API_KEY && !env.GEMINI_API_KEY
        ? 'MISSING'
        : 'CONFIGURED',
    },
    {
      key: 'UPSTASH_REDIS_REST_URL',
      category: 'CACHE',
      required: false,
      description: 'Upstash Redis REST URL for distributed rate limiting',
      status: !env.UPSTASH_REDIS_REST_URL
        ? 'NOT_REQUIRED'
        : env.UPSTASH_REDIS_REST_URL.startsWith('https://')
        ? 'CONFIGURED'
        : 'INVALID',
    },
    {
      key: 'INNGEST_SIGNING_KEY',
      category: 'ASYNC_JOBS',
      required: isProd,
      description: 'Inngest webhook signing key for background workflows',
      status: !env.INNGEST_SIGNING_KEY
        ? (isProd ? 'MISSING' : 'NOT_REQUIRED')
        : 'CONFIGURED',
    },
    {
      key: 'ALLOW_DATABASE_RESET',
      category: 'DATABASE',
      required: false,
      description: 'Production safety gate for DB teardown commands',
      status: env.ALLOW_DATABASE_RESET === 'true' && isProd ? 'INVALID' : 'CONFIGURED',
      details: env.ALLOW_DATABASE_RESET === 'true' && isProd ? 'CRITICAL: Reset enabled in production!' : 'Safety gate active',
    },
  ];

  return checks;
}
