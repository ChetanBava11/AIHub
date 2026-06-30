import type { JwtAuthPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtAuthPayload;
    }
  }
}

export {};
