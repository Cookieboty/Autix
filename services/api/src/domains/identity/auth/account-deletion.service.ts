import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from './auth-identity.repository';
import { StepUpService } from './step-up/step-up.service';
import { RateLimitService } from '../../platform/common/rate-limit.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly identity: AuthIdentityRepository,
    private readonly stepUp: StepUpService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async deleteImmediately(
    userId: string,
    proof: string,
    sessionId?: string,
    usernameConfirmation?: string,
  ): Promise<{ deletedAt: Date }> {
    if (!proof || !sessionId || !usernameConfirmation) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'auth.step_up.proof_missing',
        undefined,
        { code: 'STEP_UP_INVALID_OR_EXPIRED' },
      );
    }
    const payload = this.stepUp.verifyProof(proof, userId, 'delete-account', sessionId);
    await this.rateLimit.consume([
      { key: `account-deletion:user:${userId}`, windowMs: 60_000, limit: 1 },
      { key: `account-deletion:user:${userId}:daily`, windowMs: 24 * 3600_000, limit: 3 },
    ]);
    return this.identity.anonymizeUserImmediately({
      userId,
      sessionId,
      proofJti: payload.jti,
      usernameConfirmation,
    });
  }
}
