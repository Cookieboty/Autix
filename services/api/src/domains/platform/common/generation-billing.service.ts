import { Injectable } from '@nestjs/common';

export interface HoldForGenerationParams {
  userId: string;
  taskType: string;
  modelProvider?: string;
  modelName?: string;
  quality?: string;
  resolution?: string;
  modelTier?: string;
  quantity?: number;
  seconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  referenceImages?: number;
  hasVideoInput?: boolean;
  hasAudioInput?: boolean;
}

export interface HoldResult {
  holdId: string;
  estimatedCost: number;
}

@Injectable()
export class GenerationBillingService {
  // NOTE: After the points-hold.service.ts split is complete,
  // inject PointsHoldService and PricingEstimatorService here.

  async holdForGeneration(params: HoldForGenerationParams): Promise<HoldResult> {
    // 1. Match pricing rule for taskType + optional qualifiers
    // 2. Estimate cost
    // 3. Create hold via PointsHoldService
    throw new Error('Not yet wired - pending PointsService split completion');
  }

  async confirmGeneration(holdId: string, actualCost?: number): Promise<void> {
    // Confirm the hold, using actualCost if provided (for token-based billing)
    throw new Error('Not yet wired - pending PointsService split completion');
  }

  async refundGeneration(holdId: string): Promise<void> {
    // Refund the hold (task failed/expired)
    throw new Error('Not yet wired - pending PointsService split completion');
  }
}
