import { EnrichmentProviderAdapter } from './adapter';
import { EnrichmentInput, ProviderEnrichmentResult, DiscoveredEvidenceItem, EnrichedLeadData } from '../types';

export class MockEnrichmentProvider implements EnrichmentProviderAdapter {
  readonly name = 'mock-enrichment';

  supports(input: EnrichmentInput): boolean {
    return true; // Fallback supports any lead input
  }

  async enrich(input: EnrichmentInput): Promise<ProviderEnrichmentResult> {
    const startTime = Date.now();
    const domain = input.domain?.toLowerCase() || '';
    const name = input.companyName?.toLowerCase() || '';
    const observedAt = new Date().toISOString();
    const sourceUrl = domain ? `https://${domain}` : 'mock://leadmachine/heuristics';

    const evidence: DiscoveredEvidenceItem[] = [];

    // Heuristic 1: Tech startup
    if (domain.includes('tech') || name.includes('tech') || domain.includes('software') || domain.includes('app')) {
      evidence.push(
        {
          field: 'companySize',
          value: '50-200',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'industry',
          value: 'Software & Technology',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'estimatedRevenue',
          value: '$5M - $20M',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'location',
          value: 'San Francisco, CA',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'technologies',
          value: ['React', 'Node.js', 'AWS', 'PostgreSQL', 'Next.js'],
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'decisionMakerIdentified',
          value: true,
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'contactRole',
          value: input.contactTitle || 'VP of Engineering',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        }
      );
    } else if (domain.includes('corp') || name.includes('corp') || domain.includes('enterprise') || domain.includes('global')) {
      // Heuristic 2: Enterprise
      evidence.push(
        {
          field: 'companySize',
          value: '1000+',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'industry',
          value: 'Enterprise Solutions',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'estimatedRevenue',
          value: '$100M+',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'location',
          value: 'New York, NY',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'technologies',
          value: ['Java', 'Oracle', 'Azure', 'Salesforce', 'Kubernetes'],
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'decisionMakerIdentified',
          value: false,
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'contactRole',
          value: input.contactTitle || 'Operations Director',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        }
      );
    } else {
      // Heuristic 3: Generic SMB
      evidence.push(
        {
          field: 'companySize',
          value: '1-10',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'industry',
          value: 'General Business',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'estimatedRevenue',
          value: '< $1M',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'location',
          value: input.location || 'Unknown',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'technologies',
          value: [],
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'decisionMakerIdentified',
          value: false,
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        },
        {
          field: 'contactRole',
          value: input.contactTitle || 'Unknown',
          sourceType: 'MOCK',
          sourceUrl,
          provider: this.name,
          confidence: 'LOW',
          verificationStatus: 'VERIFIED',
          observedAt,
        }
      );
    }

    return {
      providerName: this.name,
      success: true,
      evidence,
      latencyMs: Date.now() - startTime,
    };
  }
}
