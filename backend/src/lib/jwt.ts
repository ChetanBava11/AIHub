import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtAuthPayload {
  userId: string;
  tenantId: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const signAccessToken = (payload: JwtAuthPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const verifyAccessToken = (token: string): JwtAuthPayload =>
  jwt.verify(token, env.JWT_SECRET) as JwtAuthPayload;

export const generateOpaqueRefreshToken = (): string => crypto.randomBytes(48).toString("hex");

export const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const buildSessionTokens = (payload: JwtAuthPayload): SessionTokens => {
  const refreshToken = generateOpaqueRefreshToken();

  return {
    accessToken: signAccessToken(payload),
    refreshToken,
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  };
};

export const getRefreshTokenTtlMs = (): number => REFRESH_TOKEN_TTL_MS;
