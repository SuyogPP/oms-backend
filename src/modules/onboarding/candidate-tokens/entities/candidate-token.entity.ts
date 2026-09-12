export class CandidateTokenEntity {
  tokenId: string;
  onboardingId: string;
  expiresAt: Date;
  consumedCount: number;
  revokedAt: Date | null;
  createdAt: Date;
}
