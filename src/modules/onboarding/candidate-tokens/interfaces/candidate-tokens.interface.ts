export interface ICandidateAccessToken {
  tokenId: string;
  onboardingId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedCount: number;
  revokedAt: Date | null;
  createdAt: Date;
}
