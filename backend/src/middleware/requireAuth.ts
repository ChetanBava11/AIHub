import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "../lib/jwt";

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies[ACCESS_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    // This is the core tenant-isolation rule for the whole platform.
    // Future controllers must ONLY trust req.auth.tenantId, which comes from a verified
    // server-issued JWT. Never read tenantId from body, params, query, or headers.
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ message: "Access token is missing, invalid, or expired." });
  }
};
