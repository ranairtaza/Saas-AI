import { ExecutivePriorityInput, ExecutivePriorityLevel } from './types';

export interface PriorityEvaluationResult {
  score: number;
  level: ExecutivePriorityLevel;
  breakdown: {
    revenueExposure: number;
    urgency: number;
    goalAlignment: number;
    confidence: number;
  };
}

export class ExecutivePriorityEngine {
  /**
   * Deterministically calculates priority score (0-100) and maps to ExecutivePriorityLevel
   *
   * Formula:
   * Priority Score = (Revenue Exposure × 0.35) + (Urgency × 0.25) + (Goal Alignment × 0.25) + (Confidence × 0.15)
   */
  static calculatePriority(input: ExecutivePriorityInput): PriorityEvaluationResult {
    // 1. Normalize dimensions to 0-100
    const revenueExposure = Math.min(100, Math.max(0, input.revenueExposure));
    const urgency = Math.min(100, Math.max(0, input.urgency));
    const goalAlignment = Math.min(100, Math.max(0, input.goalAlignment));

    let confidenceNum: number;
    if (typeof input.confidence === 'number') {
      confidenceNum = Math.min(100, Math.max(0, input.confidence));
    } else {
      switch (input.confidence) {
        case 'HIGH':
          confidenceNum = 100;
          break;
        case 'MEDIUM':
          confidenceNum = 60;
          break;
        case 'LOW':
          confidenceNum = 20;
          break;
        default:
          confidenceNum = 50;
      }
    }

    // 2. Weighted calculation
    const weightedScore =
      revenueExposure * 0.35 +
      urgency * 0.25 +
      goalAlignment * 0.25 +
      confidenceNum * 0.15;

    const finalScore = Math.min(100, Math.max(0, Math.round(weightedScore)));

    // 3. Map to priority tier
    let level: ExecutivePriorityLevel;
    if (finalScore >= 80) {
      level = 'CRITICAL';
    } else if (finalScore >= 60) {
      level = 'HIGH';
    } else if (finalScore >= 40) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }

    return {
      score: finalScore,
      level,
      breakdown: {
        revenueExposure,
        urgency,
        goalAlignment,
        confidence: confidenceNum,
      },
    };
  }

  /**
   * Helper to map a numeric score directly to an ExecutivePriorityLevel
   */
  static scoreToLevel(score: number): ExecutivePriorityLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }
}
