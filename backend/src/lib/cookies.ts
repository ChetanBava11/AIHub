import type { CookieOptions, Response } from "express";
import { env } from "../config/env";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenTtlMs
} from "./jwt";
import { OAUTH_STATE_COOKIE, PKCE_VERIFIER_COOKIE } from "./oauth";

const isSecureCookie = env.NODE_ENV !== "test";

export const buildSessionCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: isSecureCookie,
  sameSite: "lax",
  path: "/",
  maxAge
});

export const buildSignedShortLivedCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isSecureCookie,
  sameSite: "lax",
  signed: true,
  path: "/",
  maxAge: 10 * 60 * 1000
});

export const setSessionCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshTokenExpiresAt: Date
): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildSessionCookieOptions(15 * 60 * 1000));
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    buildSessionCookieOptions(refreshTokenExpiresAt.getTime() - Date.now())
  );
};

export const clearSessionCookies = (res: Response): void => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, buildSessionCookieOptions(0));
  res.clearCookie(REFRESH_TOKEN_COOKIE, buildSessionCookieOptions(0));
};

export const setPkceCookies = (res: Response, verifier: string, state: string): void => {
  const options = buildSignedShortLivedCookieOptions();
  res.cookie(PKCE_VERIFIER_COOKIE, verifier, options);
  res.cookie(OAUTH_STATE_COOKIE, state, options);
};

export const clearPkceCookies = (res: Response): void => {
  const options = buildSignedShortLivedCookieOptions();
  res.clearCookie(PKCE_VERIFIER_COOKIE, options);
  res.clearCookie(OAUTH_STATE_COOKIE, options);
};
