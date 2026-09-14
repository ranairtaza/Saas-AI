import { LeadProvider, TargetCriteria, NormalizedLead } from "./lead-provider";

export class MockProvider implements LeadProvider {
  async search(
    criteria: TargetCriteria,
    page: number = 1
  ): Promise<{ leads: NormalizedLead[]; hasMore: boolean; total?: number }> {
    // Artificial delay to simulate provider latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    const limit = criteria.limit || 10;
    const perPage = Math.min(limit, 50);

    // If page > 1, we just return empty in mock to simplify, or return a chunk
    if (page > Math.ceil(limit / perPage)) {
      return { leads: [], hasMore: false, total: limit };
    }

    const industry = criteria.industry || 'Technology';
    const location = criteria.location || 'Global';
    
    // Generate a chunk of mock leads
    const leads: NormalizedLead[] = Array.from({ length: perPage }).map((_, i) => {
      const idx = ((page - 1) * perPage) + i;
      return {
        companyName: `Mock ${industry} Corp ${idx}`,
        domain: `mock${idx}.example.com`,
        contactName: `John Doe ${idx}`,
        contactEmail: `john.doe.${idx}@mock${idx}.example.com`,
        contactTitle: criteria.jobTitles || 'CEO',
        phone: '+1234567890',
        location: location,
        source: 'MOCK',
        status: 'UNVERIFIED',
        enrichmentData: null,
        aiScore: null,
        aiSummary: null,
        notes: null
      };
    });

    return { 
      leads, 
      hasMore: page < Math.ceil(limit / perPage), 
      total: limit 
    };
  }
}
