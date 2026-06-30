import { z } from "zod";
import { AppError } from "../lib/errors";
import {
  buildSessionTokens,
  hashRefreshToken,
  type JwtAuthPayload,
  type SessionTokens
} from "../lib/jwt";
import {
  buildGoogleConsentUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState
} from "../lib/oauth";
import {
  AuthRepository,
  DEFAULT_TENANT_NAME,
  type SessionUser,
  type UpdateTenantInput
} from "./authRepository";

const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().min(1).max(120),
  size: z.string().trim().min(1).max(80)
});

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  startGoogleOAuth(): { url: string; verifier: string; state: string } {
    const verifier = generateCodeVerifier();
    const state = generateOAuthState();
    const challenge = generateCodeChallenge(verifier);

    // The controller stores the verifier in a signed cookie before redirecting
    // the browser to Google. Only the backend can later read that verifier back.
    return {
      url: buildGoogleConsentUrl(challenge, state),
      verifier,
      state
    };
  }

  async completeGoogleOAuth(input: {
    code: string;
    codeVerifier: string;
  }): Promise<{ user: SessionUser; onboardingRequired: boolean; created: boolean }> {
    const tokens = await exchangeCodeForTokens(input.code, input.codeVerifier);
    const profile = await fetchGoogleProfile(tokens.access_token);
    const { user, created } = await this.authRepository.upsertGoogleUser(profile);

    await this.authRepository.createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: created ? "auth.google.signup" : "auth.google.login",
      details: {
        googleId: profile.googleId,
        email: profile.email
      }
    });

    return {
      user,
      created,
      onboardingRequired: this.isOnboardingRequired(user)
    };
  }

  async issueSession(user: SessionUser): Promise<SessionTokens> {
    const payload: JwtAuthPayload = {
      userId: user.id,
      tenantId: user.tenantId
    };

    const sessionTokens = buildSessionTokens(payload);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(sessionTokens.refreshToken),
      expiresAt: sessionTokens.refreshTokenExpiresAt
    });

    return sessionTokens;
  }

  async rotateRefreshToken(rawRefreshToken: string): Promise<{ user: SessionUser; tokens: SessionTokens }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const storedToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new AppError("Refresh token is invalid.", 401);
    }

    if (storedToken.used) {
      // A used refresh token appearing again is treated as a replay attempt.
      // We revoke the full token family for that user so a stolen token cannot
      // continue minting fresh sessions in parallel with the real user.
      await this.authRepository.revokeAllRefreshTokensForUser(storedToken.userId);
      throw new AppError("Refresh token reuse detected. Please sign in again.", 401);
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.authRepository.revokeRefreshTokenByHash(tokenHash);
      throw new AppError("Refresh token has expired.", 401);
    }

    const markedUsed = await this.authRepository.markRefreshTokenUsed(storedToken.id);

    if (!markedUsed) {
      // This catches near-simultaneous refresh attempts. Only one request wins
      // the race to consume the token; the other is handled as suspicious reuse.
      await this.authRepository.revokeAllRefreshTokensForUser(storedToken.userId);
      throw new AppError("Refresh token reuse detected. Please sign in again.", 401);
    }

    const user = await this.authRepository.findUserById(storedToken.userId);

    if (!user) {
      throw new AppError("User session could not be restored.", 401);
    }

    const tokens = await this.issueSession(user);

    await this.authRepository.createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: "auth.refresh.rotated"
    });

    return { user, tokens };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const storedToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (storedToken) {
      await this.authRepository.revokeRefreshTokenByHash(tokenHash);
    }
  }

  async getCurrentUser(userId: string): Promise<{ user: SessionUser; onboardingRequired: boolean }> {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new AppError("Authenticated user was not found.", 404);
    }

    return {
      user,
      onboardingRequired: this.isOnboardingRequired(user)
    };
  }

  async completeOnboarding(tenantId: string, input: UpdateTenantInput) {
    const parsed = onboardingSchema.parse(input);
    const tenant = await this.authRepository.updateTenant(tenantId, parsed);

    return tenant;
  }

  private isOnboardingRequired(user: SessionUser): boolean {
    return user.tenant.name === DEFAULT_TENANT_NAME || !user.tenant.industry;
  }
}
