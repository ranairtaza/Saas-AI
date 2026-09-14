import { StrategicOption, StrategyComparisonResult } from './types';

export class StrategyScoringEngine {
  /**
   * Clamps a value to the 0-100 range.
   */
  private static clamp100(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.max(0, Math.min(100, val));
  }

  /**
   * Calculates the deterministic Strategic Score for a strategic option:
   * Score = (Expected Impact * 0.30)
   *       + (Goal Alignment * 0.20)
   *       + (Evidence Strength * 0.20)
   *       + (Confidence * 0.15)
   *       - (Risk * 0.10)
   *       - (Operational Pressure * 0.05)
   */
  static calculateScore(input: {
    expectedImpact: number;
    goalAlignment: number;
    evidenceStrength: number;
    confidence: number;
    risk: number;
    operationalPressure: number;
  }): number {
    const impact = this.clamp100(input.expectedImpact);
    const alignment = this.clamp100(input.goalAlignment);
    const evidence = this.clamp100(input.evidenceStrength);
    const conf = this.clamp100(input.confidence);
    const risk = this.clamp100(input.risk);
    const pressure = this.clamp100(input.operationalPressure);

    const rawScore =
      impact * 0.30 +
      alignment * 0.20 +
      evidence * 0.20 +
      conf * 0.15 -
      risk * 0.10 -
      pressure * 0.05;

    return Math.round(this.clamp100(rawScore));
  }

  /**
   * Compares and ranks an array of strategic options deterministically.
   */
  static compareStrategies(
    organizationId: string,
    options: StrategicOption[],
    historicalInsights: string[] = []
  ): StrategyComparisonResult {
    if (options.length === 0) {
      throw new Error('Cannot compare empty list of strategic options.');
    }

    // Re-score all options to ensure 100% mathematical consistency
    const scoredOptions = options.map((opt) => ({
      ...opt,
      strategicScore: this.calculateScore({
        expectedImpact: opt.expectedImpact,
        goalAlignment: opt.goalAlignment,
        evidenceStrength: opt.evidenceStrength,
        confidence: opt.confidence,
        risk: opt.risk,
        operationalPressure: opt.operationalPressure,
      }),
    }));

    // Sort descending by score; break ties deterministically by evidenceStrength, then impact
    scoredOptions.sort((a, b) => {
      if (b.strategicScore !== a.strategicScore) {
        return b.strategicScore - a.strategicScore;
      }
      if (b.evidenceStrength !== a.evidenceStrength) {
        return b.evidenceStrength - a.evidenceStrength;
      }
      return b.expectedImpact - a.expectedImpact;
    });

    const topOption = scoredOptions[0];
    const rankingRationale = `Recommended option "${topOption.name}" ranks #1 with a strategic score of ${topOption.strategicScore}/100 (Impact: ${topOption.expectedImpact}, Evidence: ${topOption.evidenceStrength}, Risk: ${topOption.risk}).`;

    return {
      organizationId,
      evaluatedAt: new Date(),
      options: scoredOptions,
      recommendedOptionId: topOption.id,
      rankingRationale,
      historicalContextInsights: historicalInsights,
    };
  }
}
