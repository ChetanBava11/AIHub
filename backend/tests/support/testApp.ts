import { createApp, type AppServices } from "../../src/app";
import { AuthService } from "../../src/services/authService";
import { InMemoryAuthRepository } from "./InMemoryAuthRepository";
import { TenantService } from "../../src/services/tenantService";

export const createTestHarness = () => {
  const authRepository = new InMemoryAuthRepository();
  const authService = new AuthService(authRepository);
  const tenantService = new TenantService(authService);
  const services: AppServices = {
    authService,
    tenantService
  };

  return {
    app: createApp(services),
    authRepository,
    authService
  };
};
