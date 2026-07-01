import { createApp, type AppServices } from "../../src/app";
import { ContactService } from "../../src/services/contactService";
import { DashboardService } from "../../src/services/dashboardService";
import { AuthService } from "../../src/services/authService";
import { InboxService } from "../../src/services/inboxService";
import { OpportunityService } from "../../src/services/opportunityService";
import { TaskService } from "../../src/services/taskService";
import { InMemoryAuthRepository } from "./InMemoryAuthRepository";
import { TenantService } from "../../src/services/tenantService";

export const createTestHarness = () => {
  const authRepository = new InMemoryAuthRepository();
  const authService = new AuthService(authRepository);
  const contactService = new ContactService();
  const dashboardService = new DashboardService();
  const inboxService = new InboxService();
  const opportunityService = new OpportunityService();
  const taskService = new TaskService();
  const tenantService = new TenantService(authService);
  const services: AppServices = {
    authService,
    contactService,
    dashboardService,
    inboxService,
    opportunityService,
    taskService,
    tenantService
  };

  return {
    app: createApp(services),
    authRepository,
    authService
  };
};
