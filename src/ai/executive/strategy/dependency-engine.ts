import {
  BusinessDomain,
  CrossDomainDependency,
  DependencyType,
  EvidenceStrength,
} from './types';
import { BusinessContext } from '../types';

export class CrossDomainDependencyEngine {
  /**
   * Evaluates all known cross-domain relationships for a given business context.
   * Guarantees strict distinction between direct operational dependencies and correlations.
   */
  static analyzeDependencies(context: BusinessContext): CrossDomainDependency[] {
    const dependencies: CrossDomainDependency[] = [];

    // 1. Operations Capacity -> Sales Lead Assignment & Response Velocity
    // Direct deterministic causal link in CRM operations
    dependencies.push({
      id: 'dep-ops-sales-assignment',
      sourceDomain: 'OPERATIONS',
      sourceMetric: 'unassignedHighPriorityLeads',
      targetDomain: 'SALES',
      targetMetric: 'leadResponseVelocity',
      relationshipType: 'VERIFIED_DEPENDENCY',
      evidenceStrength: 'STRONG',
      confidence: 95,
      rationale:
        'Unassigned high-priority leads directly bottleneck lead response velocity within sales operations.',
      falsificationCriteria:
        'If unassigned lead count reaches zero while response times remain elevated due to external factors.',
    });

    // 2. Sales Response Velocity -> Pipeline Conversion
    // Operational link supported by direct qualification mechanics
    const hasUnassigned = (context.telemetry.metrics.unassignedHighPriorityLeads.value ?? 0) > 0;
    dependencies.push({
      id: 'dep-sales-pipeline-conversion',
      sourceDomain: 'SALES',
      sourceMetric: 'leadResponseVelocity',
      targetDomain: 'PIPELINE',
      targetMetric: 'pipelineValue',
      relationshipType: 'VERIFIED_DEPENDENCY',
      evidenceStrength: hasUnassigned ? 'STRONG' : 'MODERATE',
      confidence: 85,
      rationale:
        'Rapid engagement of qualified leads directly protects deal velocity and pipeline expansion.',
    });

    // 3. Pipeline Value -> Monthly Recurring Revenue (MRR)
    // Direct financial realization dependency
    dependencies.push({
      id: 'dep-pipeline-revenue',
      sourceDomain: 'PIPELINE',
      sourceMetric: 'pipelineValue',
      targetDomain: 'REVENUE',
      targetMetric: 'revenueMTD',
      relationshipType: 'VERIFIED_DEPENDENCY',
      evidenceStrength: 'STRONG',
      confidence: 90,
      rationale:
        'Qualified pipeline value provides the deterministic upper bound for recognized monthly revenue conversion.',
    });

    // 4. Marketing Lead Discovery -> Sales Qualified Leads
    // Observed correlation based on lead flow quality
    const highValLeads = context.telemetry.metrics.qualifiedLeads.value;
    dependencies.push({
      id: 'dep-mktg-sales-volume',
      sourceDomain: 'MARKETING',
      sourceMetric: 'activeLeadsCount',
      targetDomain: 'SALES',
      targetMetric: 'qualifiedLeadsCount',
      relationshipType: 'OBSERVED_CORRELATION',
      evidenceStrength: (highValLeads ?? 0) > 0 ? 'MODERATE' : 'WEAK',
      confidence: 70,
      rationale:
        'Total discovered leads correlate with qualified lead volume, subject to ICP targeting precision and enrichment data quality.',
    });

    // 5. Check Historical Outcomes for validated/refuted patterns
    if (context.historicalPerformance) {
      const topStrategies = context.historicalPerformance.topValidatedStrategies || [];
      const refuted = context.historicalPerformance.refutedHypotheses || [];

      if (topStrategies.some((s) => s.toLowerCase().includes('enterprise') || s.toLowerCase().includes('assign'))) {
        dependencies.push({
          id: 'dep-hist-validated-assignment',
          sourceDomain: 'OPERATIONS',
          sourceMetric: 'leadAssignmentSpeed',
          targetDomain: 'REVENUE',
          targetMetric: 'revenueMTD',
          relationshipType: 'OBSERVED_CORRELATION',
          evidenceStrength: 'STRONG',
          confidence: 80,
          rationale:
            'Historical executive outcomes confirm that prioritizing high-value lead assignment correlates with positive revenue pacing.',
        });
      }

      if (refuted.some((r) => r.toLowerCase().includes('cold') || r.toLowerCase().includes('unenriched'))) {
        dependencies.push({
          id: 'dep-hist-refuted-cold-outreach',
          sourceDomain: 'MARKETING',
          sourceMetric: 'rawOutreachVolume',
          targetDomain: 'PIPELINE',
          targetMetric: 'pipelineValue',
          relationshipType: 'INCONCLUSIVE',
          evidenceStrength: 'UNVERIFIED',
          confidence: 30,
          rationale:
            'Previously refuted hypothesis: Scaling raw unenriched outreach volume does not produce statistically significant pipeline growth.',
          falsificationCriteria: 'Requires a controlled trial showing conversion rates above 2%.',
        });
      }
    }

    return dependencies;
  }

  /**
   * Validates and classifies an arbitrary proposed dependency claim.
   * Strictly downgrades/rejects unsupported causal claims.
   */
  static validateRelationshipClaim(claim: {
    sourceDomain: BusinessDomain;
    sourceMetric: string;
    targetDomain: BusinessDomain;
    targetMetric: string;
    claimedType: DependencyType;
    evidenceNotes?: string;
  }): {
    validatedType: DependencyType;
    evidenceStrength: EvidenceStrength;
    confidence: number;
    downgraded: boolean;
    rationale: string;
  } {
    const isDirectOperational =
      (claim.sourceDomain === 'OPERATIONS' && claim.targetDomain === 'SALES') ||
      (claim.sourceMetric === 'unassignedHighPriorityLeads' && claim.targetMetric === 'leadResponseVelocity') ||
      (claim.sourceDomain === 'PIPELINE' && claim.targetDomain === 'REVENUE' && claim.sourceMetric === 'pipelineValue');

    if (claim.claimedType === 'VERIFIED_DEPENDENCY') {
      if (isDirectOperational) {
        return {
          validatedType: 'VERIFIED_DEPENDENCY',
          evidenceStrength: 'STRONG',
          confidence: 90,
          downgraded: false,
          rationale: 'Direct operational link backed by platform mechanics.',
        };
      } else {
        // Downgrade unsupported causal claim to OBSERVED_CORRELATION or STRATEGIC_HYPOTHESIS
        return {
          validatedType: 'OBSERVED_CORRELATION',
          evidenceStrength: 'MODERATE',
          confidence: 65,
          downgraded: true,
          rationale:
            'Downgraded from VERIFIED_DEPENDENCY: Broad cross-domain interactions involve confounding market and organizational factors and cannot be claimed as strictly causal without direct deterministic control.',
        };
      }
    }

    return {
      validatedType: claim.claimedType,
      evidenceStrength: 'MODERATE',
      confidence: 70,
      downgraded: false,
      rationale: 'Relationship classified as supportive hypothesis or observed correlation.',
    };
  }
}
