import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { createAuthController } from "./controllers/authController";
import { createMeController } from "./controllers/meController";
import { createTenantController } from "./controllers/tenantController";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { buildAuthRouter } from "./routes/authRoutes";
import { buildMeRouter } from "./routes/meRoutes";
import { buildTenantRouter } from "./routes/tenantRoutes";
import { AuthService } from "./services/authService";
import { PrismaAuthRepository } from "./services/authRepository";
import { TenantService } from "./services/tenantService";

export interface AppServices {
  authService: AuthService;
  tenantService: TenantService;
}

export const createDefaultServices = (): AppServices => {
  const authRepository = new PrismaAuthRepository();
  const authService = new AuthService(authRepository);
  const tenantService = new TenantService(authService);

  return {
    authService,
    tenantService
  };
};

export const createApp = (services: AppServices = createDefaultServices()) => {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.json());
  app.use(cookieParser(env.COOKIE_SECRET));

  const authController = createAuthController(services.authService);
  const tenantController = createTenantController(services.tenantService);
  const meController = createMeController(services.authService);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", buildAuthRouter(authController));
  app.use("/tenant", buildTenantRouter(tenantController));
  app.use("/me", buildMeRouter(meController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
