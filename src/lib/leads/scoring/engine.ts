import { EnrichedLeadData } from '../enrichment/types';

export type QualificationCategory = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNQUALIFIED';

export interface ScoreFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ScoreResult {
  score: number;
  category: QualificationCategory;
  factors: ScoreFactor[];
}

export class DeterministicScoringEngine {
  static score(
    lead: { contactName?: string | null; contactEmail?: string | null; phone?: string | null; industry?: string | null },
    enrichment: EnrichedLeadData | null
  ): ScoreResult {
    const factors: ScoreFactor[] = [];
    let totalScore = 0;

    // Base contact info (max 20 pts)
    let contactPts = 0;
    const contactReasons = [];
    if (lead.contactName) { contactPts += 5; contactReasons.push('Name'); }
    if (lead.contactEmail) { contactPts += 10; contactReasons.push('Email'); }
    if (lead.phone) { contactPts += 5; contactReasons.push('Phone'); }
    factors.push({
      name: 'Contact Completeness',
      points: contactPts,
      maxPoints: 20,
      reason: contactPts > 0 ? `Found: ${contactReasons.join(', ')}` : 'Missing contact information.'
    });
    totalScore += contactPts;

    // Industry (max 15 pts)
    const industry = enrichment?.industry || lead.industry || '';
    let industryPts = 0;
    let industryReason = 'Industry unknown';
    if (industry.length > 0) {
      if (['Software & Technology', 'Enterprise Solutions', 'SaaS', 'Finance'].includes(industry)) {
        industryPts = 15;
        industryReason = `High-value industry: ${industry}`;
      } else {
        industryPts = 5;
        industryReason = `Standard industry: ${industry}`;
      }
    }
    factors.push({
      name: 'Industry Match',
      points: industryPts,
      maxPoints: 15,
      reason: industryReason
    });
    totalScore += industryPts;

    // Enrichment Data Presence (max 10 pts)
    const enrichmentPts = enrichment ? 10 : 0;
    factors.push({
      name: 'Enrichment Data',
      points: enrichmentPts,
      maxPoints: 10,
      reason: enrichment ? 'Third-party enrichment data available.' : 'No enrichment data available.'
    });
    totalScore += enrichmentPts;

    // Decision Maker (max 15 pts)
    const dmPts = enrichment?.decisionMakerIdentified ? 15 : 0;
    factors.push({
      name: 'Decision Maker',
      points: dmPts,
      maxPoints: 15,
      reason: dmPts > 0 ? 'Verified decision-maker title.' : 'Not identified as decision maker.'
    });
    totalScore += dmPts;

    // Revenue (max 20 pts)
    let revPts = 0;
    let revReason = 'Revenue unknown or too small';
    if (enrichment?.estimatedRevenue) {
      if (['$5M - $20M', '$20M - $100M', '$100M+'].includes(enrichment.estimatedRevenue)) {
        revPts = 20;
        revReason = `Target revenue tier: ${enrichment.estimatedRevenue}`;
      } else if (enrichment.estimatedRevenue !== '< $1M' && enrichment.estimatedRevenue !== 'Unknown') {
        revPts = 10;
        revReason = `Mid revenue tier: ${enrichment.estimatedRevenue}`;
      }
    }
    factors.push({
      name: 'Company Revenue',
      points: revPts,
      maxPoints: 20,
      reason: revReason
    });
    totalScore += revPts;

    // Size (max 20 pts)
    let sizePts = 0;
    let sizeReason = 'Size unknown or too small';
    if (enrichment?.companySize) {
      if (['50-200', '200-1000', '1000+'].includes(enrichment.companySize)) {
        sizePts = 20;
        sizeReason = `Target size tier: ${enrichment.companySize}`;
      } else if (enrichment.companySize !== '1-10' && enrichment.companySize !== 'Unknown') {
        sizePts = 10;
        sizeReason = `Mid size tier: ${enrichment.companySize}`;
      }
    }
    factors.push({
      name: 'Company Size',
      points: sizePts,
      maxPoints: 20,
      reason: sizeReason
    });
    totalScore += sizePts;

    const finalScore = Math.min(100, Math.max(0, totalScore));

    return {
      score: finalScore,
      category: this.categorize(finalScore),
      factors
    };
  }

  static categorize(score: number): QualificationCategory {
    if (score >= 75) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    if (score >= 25) return 'LOW';
    return 'UNQUALIFIED';
  }
}
