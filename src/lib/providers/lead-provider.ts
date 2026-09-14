export interface TargetCriteria {
  industry?: string;
  location?: string;
  jobTitles?: string;
  limit?: number;
  provider?: string;
}

export interface NormalizedLead {
  companyName: string;
  domain: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  phone: string | null;
  location: string | null;
  source: string;
  status: string;
  enrichmentData: string | null;
  aiScore: number | null;
  aiSummary: string | null;
  notes: string | null;
}

export interface LeadProvider {
  /**
   * Search for leads matching the target criteria.
   * Supports pagination for providers that fetch data in chunks.
   */
  search(
    criteria: TargetCriteria,
    page?: number
  ): Promise<{ leads: NormalizedLead[]; hasMore: boolean; total?: number }>;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  try {
    let raw = domain.trim().toLowerCase();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = 'https://' + raw;
    }
    const url = new URL(raw);
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return domain.trim().toLowerCase();
  }
}
