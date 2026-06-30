import type { AuthService } from "./authService";

export class TenantService {
  constructor(private readonly authService: AuthService) {}

  async updateOnboarding(
    tenantId: string,
    payload: { name: string; industry: string; size: string }
  ) {
    return this.authService.completeOnboarding(tenantId, payload);
  }
}
