import { Router } from "express";
import type { createAuthController } from "../controllers/authController";

export const buildAuthRouter = (
  authController: ReturnType<typeof createAuthController>
) => {
  const router = Router();

  router.get("/google/init", authController.googleInit);
  router.get("/google/callback", authController.googleCallback);
  router.post("/refresh", authController.refresh);
  router.post("/logout", authController.logout);

  return router;
};
