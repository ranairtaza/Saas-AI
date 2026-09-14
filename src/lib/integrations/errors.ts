export type IntegrationErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN';

export class IntegrationError extends Error {
  public code: IntegrationErrorCode;
  public details?: any;
  public provider?: string;

  constructor(code: IntegrationErrorCode, message: string, provider?: string, details?: any) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.provider = provider;
    this.details = details;
  }
}

export function classifyError(error: any): IntegrationErrorCode {
  if (error instanceof IntegrationError) {
    return error.code;
  }

  const message = (error?.message || '').toLowerCase();

  if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden') || message.includes('credentials') || message.includes('api key')) {
    return 'AUTH_ERROR';
  }
  
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return 'RATE_LIMIT';
  }

  if (message.includes('timeout') || message.includes('etimedout') || message.includes('econnreset') || message.includes('econnrefused')) {
    return 'NETWORK_ERROR';
  }

  if (error?.code === 'P2002' || message.includes('prisma') || message.includes('database')) {
    return 'DATABASE_ERROR';
  }

  if (message.includes('validation') || message.includes('invalid') || message.includes('malformed')) {
    return 'VALIDATION_ERROR';
  }

  if (message.includes('stripe') || message.includes('provider') || error?.type?.includes('Stripe')) {
    return 'PROVIDER_ERROR';
  }

  return 'UNKNOWN';
}
