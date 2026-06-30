import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "./errors";

export const PKCE_VERIFIER_COOKIE = "oauth_pkce_verifier";
export const OAUTH_STATE_COOKIE = "oauth_state";

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

const GOOGLE_SCOPE = "openid email profile";

const base64UrlEncode = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export const generateCodeVerifier = (): string => base64UrlEncode(crypto.randomBytes(64));

export const generateCodeChallenge = (codeVerifier: string): string =>
  base64UrlEncode(crypto.createHash("sha256").update(codeVerifier).digest());

export const generateOAuthState = (): string => base64UrlEncode(crypto.randomBytes(32));

export const buildGoogleConsentUrl = (codeChallenge: string, state: string): string => {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  // PKCE keeps the authorization code unusable on its own. Google receives only
  // the derived challenge here, while the original verifier stays in our
  // signed cookie until the callback proves it belongs to the same browser flow.
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  return url.toString();
};

export const exchangeCodeForTokens = async (code: string, codeVerifier: string) => {
  // The callback redeems the code only if it can present the original verifier.
  // That extra secret is what stops intercepted authorization codes from being
  // traded for tokens by a different client.
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError("Google token exchange failed.", 502, text);
  }

  return (await response.json()) as { access_token: string };
};

export const fetchGoogleProfile = async (accessToken: string): Promise<GoogleProfile> => {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError("Failed to fetch Google profile.", 502, text);
  }

  const payload = (await response.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };

  if (!payload.sub || !payload.email || !payload.name) {
    throw new AppError("Google profile response was missing required fields.", 502, payload);
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name
  };
};
