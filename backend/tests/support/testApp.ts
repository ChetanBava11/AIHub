import { createApp, type AppServices } from "../../src/app";
import { ContactService } from "../../src/services/contactService";
import { AuthService } from "../../src/services/authService";
import { OpportunityService } from "../../src/services/opportunityService";
import { InMemoryAuthRepository } from "./InMemoryAuthRepository";
import { TenantService } from "../../src/services/tenantService";

export const createTestHarness = () => {
  const authRepository = new InMemoryAuthRepository();
  const authService = new AuthService(authRepository);
  const contactService = new ContactService();
  const opportunityService = new OpportunityService();
  const tenantService = new TenantService(authService);
  const services: AppServices = {
    authService,
    contactService,
    opportunityService,
    tenantService
  };

  return {
    app: createApp(services),
    authRepository,
    authService
  };
};
