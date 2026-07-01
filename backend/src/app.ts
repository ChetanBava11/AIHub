import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { createAuthController } from "./controllers/authController";
import { createContactController } from "./controllers/contactController";
import { createDashboardController } from "./controllers/dashboardController";
import { createInboxController } from "./controllers/inboxController";
import { createOpportunityController } from "./controllers/opportunityController";
import { createMeController } from "./controllers/meController";
import { createTaskController } from "./controllers/taskController";
import { createTenantController } from "./controllers/tenantController";
import { createAIController } from "./controllers/aiController";
import { createWorkflowController } from "./controllers/workflowController";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { buildAuthRouter } from "./routes/authRoutes";
import { buildContactRouter } from "./routes/contact.routes";
import { buildDashboardRouter } from "./routes/dashboard.routes";
import { buildInboxRouter } from "./routes/inbox.routes";
import { buildOpportunityRouter } from "./routes/opportunity.routes";
import { buildTaskRouter } from "./routes/task.routes";
import { buildMeRouter } from "./routes/meRoutes";
import { buildTenantRouter } from "./routes/tenantRoutes";
import { buildAIRouter } from "./routes/ai.routes";
import { buildWorkflowRouter } from "./routes/workflow.routes";
import { ContactService } from "./services/contactService";
import { AuthService } from "./services/authService";
import { PrismaAuthRepository } from "./services/authRepository";
import { DashboardService } from "./services/dashboardService";
import { InboxService } from "./services/inboxService";
import { OpportunityService } from "./services/opportunityService";
import { TaskService } from "./services/taskService";
import { TenantService } from "./services/tenantService";
import { AIService } from "./services/aiService";
import { WorkflowService } from "./services/workflowService";

export interface AppServices {
  authService: AuthService;
  contactService: ContactService;
  dashboardService: DashboardService;
  inboxService: InboxService;
  opportunityService: OpportunityService;
  taskService: TaskService;
  tenantService: TenantService;
  aiService: AIService;
}

export const createDefaultServices = (): AppServices => {
  const authRepository = new PrismaAuthRepository();
  const authService = new AuthService(authRepository);
  const aiService = new AIService();
  const contactService = new ContactService();
  const inboxService = new InboxService();
  const dashboardService = new DashboardService();
  const opportunityService = new OpportunityService();
  const taskService = new TaskService();
  const tenantService = new TenantService(authService);

  return {
    authService,
    contactService,
    dashboardService,
    inboxService,
    opportunityService,
    taskService,
    tenantService,
    aiService
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
  const contactController = createContactController(services.contactService);
  const dashboardController = createDashboardController(services.dashboardService);
  const inboxController = createInboxController(services.inboxService);
  const opportunityController = createOpportunityController(services.opportunityService);
  const taskController = createTaskController(services.taskService);
  const tenantController = createTenantController(services.tenantService);
  const meController = createMeController(services.authService);
  const workflowService = new WorkflowService();
  const workflowController = createWorkflowController(workflowService);
  const aiController = createAIController(services.aiService);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", buildAuthRouter(authController));
  app.use("/contacts", buildContactRouter(contactController));
  app.use("/dashboard", buildDashboardRouter(dashboardController));
  app.use("/inbox", buildInboxRouter(inboxController));
  app.use("/opportunities", buildOpportunityRouter(opportunityController));
  app.use("/tasks", buildTaskRouter(taskController));
  app.use("/tenant", buildTenantRouter(tenantController));
  app.use("/me", buildMeRouter(meController));
  app.use("/ai", buildAIRouter(aiController));
  app.use("/workflows", buildWorkflowRouter(workflowController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
