import {
  DiscoveredEvidenceItem,
  ConflictingEvidenceGroup,
  ConsolidatedEnrichmentSnapshot,
  EnrichedLeadData,
  EvidenceConfidence,
  SourceType,
} from './types';

// Weight mapping for confidence levels
const CONFIDENCE_WEIGHT: Record<EvidenceConfidence, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Weight mapping for source types (Direct verifiable sources ranked higher)
const SOURCE_WEIGHT: Record<SourceType, number> = {
  WEBSITE: 4,
  API: 4,
  TECH_DETECTOR: 3,
  SEARCH: 2,
  DIRECTORY: 2,
  USER_PROVIDED: 3,
  MOCK: 1,
  OTHER: 1,
};

/**
 * Calculates a composite reliability score for an evidence item.
 */
function getEvidenceScore(item: DiscoveredEvidenceItem): number {
  const conf = CONFIDENCE_WEIGHT[item.confidence] || 1;
  const src = SOURCE_WEIGHT[item.sourceType] || 1;
  return conf * 10 + src;
}

/**
 * Normalizes and resolves evidence items across multiple providers into a consolidated snapshot.
 */
export function normalizeAndResolveEvidence(
  evidenceList: DiscoveredEvidenceItem[],
  completedProviders: string[]
): ConsolidatedEnrichmentSnapshot {
  const evidenceByField = new Map<string, DiscoveredEvidenceItem[]>();

  for (const item of evidenceList) {
    const existing = evidenceByField.get(item.field) || [];
    existing.push(item);
    evidenceByField.set(item.field, existing);
  }

  const conflicts: ConflictingEvidenceGroup[] = [];
  const normalizedSnapshot: Partial<EnrichedLeadData> = {};

  // 1. Technologies normalization (Merged set of verified technologies)
  const techItems = evidenceByField.get('technologies') || [];
  const techSet = new Set<string>();
  for (const item of techItems) {
    if (Array.isArray(item.value)) {
      for (const t of item.value) {
        if (typeof t === 'string' && t.trim()) {
          techSet.add(t.trim());
        }
      }
    } else if (typeof item.value === 'string' && item.value.trim()) {
      techSet.add(item.value.trim());
    }
  }
  normalizedSnapshot.technologies = Array.from(techSet);

  // 2. Decision Maker normalization
  const dmItems = evidenceByField.get('decisionMakerIdentified') || [];
  if (dmItems.length > 0) {
    // If any high/medium source verified decision maker, mark true
    normalizedSnapshot.decisionMakerIdentified = dmItems.some(i => Boolean(i.value));
  } else {
    normalizedSnapshot.decisionMakerIdentified = false;
  }

  // 3. Scalar fields normalization (industry, companySize, estimatedRevenue, location, contactRole)
  const scalarFields = ['industry', 'companySize', 'estimatedRevenue', 'location', 'contactRole'] as const;

  for (const field of scalarFields) {
    const items = evidenceByField.get(field) || [];
    if (items.length === 0) continue;

    if (items.length === 1) {
      normalizedSnapshot[field] = String(items[0].value);
      continue;
    }

    // Multiple sources returned values for this field
    // Check if there are differing string values
    const distinctValues = Array.from(new Set(items.map(i => String(i.value).trim().toLowerCase())));

    if (distinctValues.length === 1) {
      // Unanimous agreement across providers
      normalizedSnapshot[field] = String(items[0].value);
      // Upgrade confidence to HIGH if multiple providers agree
      items.forEach(i => {
        i.verificationStatus = 'VERIFIED';
        i.confidence = 'HIGH';
      });
    } else {
      // Differing values -> CONFLICT DETECTED
      items.forEach(i => {
        i.verificationStatus = 'CONFLICTING';
      });

      // Sort by reliability score descending
      const sorted = [...items].sort((a, b) => getEvidenceScore(b) - getEvidenceScore(a));
      const best = sorted[0];

      normalizedSnapshot[field] = String(best.value);

      conflicts.push({
        field,
        values: items.map(i => ({
          value: i.value,
          provider: i.provider,
          confidence: i.confidence,
          sourceUrl: i.sourceUrl,
        })),
        resolvedValue: best.value,
        resolutionRationale: `Resolved to '${best.value}' from provider '${best.provider}' (${best.sourceType}, ${best.confidence} confidence).`,
      });
    }
  }

  const primaryProvider = completedProviders[0] || 'MultiSource';

  return {
    companySize: normalizedSnapshot.companySize || 'Unknown',
    industry: normalizedSnapshot.industry || 'Unknown',
    estimatedRevenue: normalizedSnapshot.estimatedRevenue || 'Unknown',
    location: normalizedSnapshot.location || 'Unknown',
    technologies: normalizedSnapshot.technologies || [],
    decisionMakerIdentified: normalizedSnapshot.decisionMakerIdentified || false,
    contactRole: normalizedSnapshot.contactRole || 'Unknown',
    sourceProvider: primaryProvider,
    enrichedAt: new Date().toISOString(),
    evidence: evidenceList,
    conflicts,
    isFresh: true,
    providersCompleted: completedProviders,
  };
}
