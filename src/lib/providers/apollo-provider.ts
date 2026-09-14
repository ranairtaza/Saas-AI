import { LeadProvider, TargetCriteria, NormalizedLead } from './lead-provider';

export class ApolloProvider implements LeadProvider {
  private apiKey: string;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(
    criteria: TargetCriteria,
    page: number = 1
  ): Promise<{ leads: NormalizedLead[]; hasMore: boolean; total?: number }> {
    const limit = criteria.limit || 10;
    const perPage = Math.min(limit, 100);
    
    const payload = {
      q_organization_domains: criteria.industry ? criteria.industry : undefined,
      person_locations: criteria.location ? [criteria.location] : undefined,
      person_titles: criteria.jobTitles ? [criteria.jobTitles] : undefined,
      page: page,
      per_page: perPage
    };

    try {
      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Api-Key': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Apollo API returned status ${response.status}`);
      }

      const data = await response.json();
      const leads = this.normalizeResponse(data);
      const totalPages = data.pagination?.total_pages || 1;
      const hasMore = page < totalPages;
      const total = data.pagination?.total_entries || leads.length;

      return { leads, hasMore, total };
    } catch (error: any) {
      console.error('Apollo Provider Error (network/parsing):', error.message);
      throw new Error('Failed to communicate with Apollo API');
    }
  }

  private normalizeResponse(data: any): NormalizedLead[] {
    if (!data || !data.people) return [];

    return data.people.map((person: any) => {
      const company = person.organization || {};
      return {
        companyName: company.name || 'Unknown Company',
        domain: company.primary_domain || null,
        contactName: person.name || null,
        contactEmail: person.email || null,
        contactTitle: person.title || null,
        phone: company.primary_phone?.number || person.phone_numbers?.[0]?.sanitized_number || null,
        location: person.city ? `${person.city}, ${person.state || ''}`.trim() : null,
        source: 'APOLLO',
        status: person.email_status === 'verified' ? 'VERIFIED' : 'UNKNOWN',
        enrichmentData: JSON.stringify({
          apollo_id: person.id,
          linkedin_url: person.linkedin_url
        }),
        aiScore: null,
        aiSummary: null,
        notes: null
      };
    });
  }
}
