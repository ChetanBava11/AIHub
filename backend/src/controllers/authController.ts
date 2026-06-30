import type { Request, Response } from "express";
import { z } from "zod";
import {
  clearPkceCookies,
  clearSessionCookies,
  setPkceCookies,
  setSessionCookies
} from "../lib/cookies";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { OAUTH_STATE_COOKIE, PKCE_VERIFIER_COOKIE } from "../lib/oauth";
import { REFRESH_TOKEN_COOKIE } from "../lib/jwt";
import { env } from "../config/env";
import type { AuthService } from "../services/authService";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

const redirectToFrontend = (res: Response, params: Record<string, string>): void => {
  const url = new URL(env.FRONTEND_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  res.redirect(url.toString());
};

export const createAuthController = (authService: AuthService) => ({
  googleInit: asyncHandler(async (_req: Request, res: Response) => {
    const { url, verifier, state } = authService.startGoogleOAuth();

    setPkceCookies(res, verifier, state);

    res.json({ url });
  }),

  googleCallback: asyncHandler(async (req: Request, res: Response) => {
    const parsedQuery = callbackQuerySchema.parse(req.query);
    const codeVerifier = req.signedCookies[PKCE_VERIFIER_COOKIE] as string | undefined;
    const expectedState = req.signedCookies[OAUTH_STATE_COOKIE] as string | undefined;

    if (!codeVerifier || !expectedState) {
      throw new AppError("OAuth session is missing or expired. Please start again.", 400);
    }

    if (parsedQuery.state !== expectedState) {
      throw new AppError("OAuth state mismatch detected.", 400);
    }

    const { user, onboardingRequired } = await authService.completeGoogleOAuth({
      code: parsedQuery.code,
      codeVerifier
    });

    const sessionTokens = await authService.issueSession(user);

    clearPkceCookies(res);
    setSessionCookies(
      res,
      sessionTokens.accessToken,
      sessionTokens.refreshToken,
      sessionTokens.refreshTokenExpiresAt
    );

    redirectToFrontend(res, {
      auth: "success",
      onboarding_required: String(onboardingRequired)
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

    if (!refreshToken) {
      throw new AppError("Refresh token cookie is missing.", 401);
    }

    const { tokens } = await authService.rotateRefreshToken(refreshToken);

    setSessionCookies(res, tokens.accessToken, tokens.refreshToken, tokens.refreshTokenExpiresAt);

    res.status(200).json({ status: "ok" });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

    await authService.logout(refreshToken);
    clearSessionCookies(res);
    res.status(204).send();
  })
});
