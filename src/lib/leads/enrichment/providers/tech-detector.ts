import { EnrichmentProviderAdapter } from './adapter';
import { EnrichmentInput, ProviderEnrichmentResult, DiscoveredEvidenceItem } from '../types';
import { safeFetchHtml } from '../security/ssrf-guard';

const TECH_SIGNATURES: Array<{ name: string; pattern: RegExp; category: string }> = [
  { name: 'React', pattern: /react(?:\.production|\.development)?\.js|data-reactroot/i, category: 'Frontend' },
  { name: 'Vue.js', pattern: /vue(?:\.runtime)?\.js|data-v-[a-z0-9]+/i, category: 'Frontend' },
  { name: 'Angular', pattern: /ng-(?:app|version|model)|@angular/i, category: 'Frontend' },
  { name: 'Tailwind CSS', pattern: /class=["'][^"']*\b(?:flex|grid|p-\d|m-\d|text-center|bg-)\b[^"']*["']/i, category: 'Styling' },
  { name: 'Google Analytics', pattern: /googletagmanager\.com\/gtag|google-analytics\.com\/analytics\.js/i, category: 'Analytics' },
  { name: 'Segment', pattern: /cdn\.segment\.com\/analytics\.js/i, category: 'Analytics' },
  { name: 'Stripe', pattern: /js\.stripe\.com\/v3/i, category: 'Payments' },
  { name: 'Intercom', pattern: /widget\.intercom\.io/i, category: 'Customer Support' },
  { name: 'HubSpot', pattern: /js\.hs-scripts\.com|js\.hsforms\.net/i, category: 'CRM & Marketing' },
  { name: 'Sentry', pattern: /browser\.sentry-cdn\.com|sentry\.io/i, category: 'Monitoring' },
  { name: 'Hotjar', pattern: /static\.hotjar\.com/i, category: 'Analytics' },
  { name: 'Shopify', pattern: /cdn\.shopify\.com/i, category: 'E-Commerce' },
  { name: 'WordPress', pattern: /wp-content|wp-includes/i, category: 'CMS' },
  { name: 'Webflow', pattern: /assets\.website-files\.com|d3e54v103j8qbb\.cloudfront\.net/i, category: 'CMS' },
];

export class TechDetectorProvider implements EnrichmentProviderAdapter {
  readonly name = 'tech-detector';

  supports(input: EnrichmentInput): boolean {
    return Boolean(input.domain && input.domain.trim().length > 0);
  }

  async enrich(input: EnrichmentInput): Promise<ProviderEnrichmentResult> {
    const startTime = Date.now();
    const domain = input.domain?.trim();

    if (!domain) {
      return {
        providerName: this.name,
        success: false,
        evidence: [],
        latencyMs: 0,
      };
    }

    try {
      const fetchResult = await safeFetchHtml(domain, { timeoutMs: 4000 });
      if (!fetchResult.ok || !fetchResult.html) {
        return {
          providerName: this.name,
          success: false,
          evidence: [],
          errorMessage: fetchResult.error || 'No content for tech detection',
          latencyMs: Date.now() - startTime,
        };
      }

      const html = fetchResult.html;
      const detectedTech: string[] = [];

      for (const sig of TECH_SIGNATURES) {
        if (sig.pattern.test(html)) {
          detectedTech.push(sig.name);
        }
      }

      const evidence: DiscoveredEvidenceItem[] = [];

      if (detectedTech.length > 0) {
        evidence.push({
          field: 'technologies',
          value: detectedTech,
          sourceType: 'TECH_DETECTOR',
          sourceUrl: `https://${domain}`,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt: new Date().toISOString(),
        });
      }

      return {
        providerName: this.name,
        success: true,
        evidence,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        success: false,
        evidence: [],
        errorMessage: err.message || 'Tech detection failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
