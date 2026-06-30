export type Tenant = {
  id: string;
  name: string | null;
  industry: string | null;
  size: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  tenantId: string;
  googleId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: string;
  tenant: Tenant;
};

export type MeResponse = {
  user: User;
  onboardingRequired: boolean;
};

export type OnboardingPayload = {
  name: string;
  industry: string;
  size: string;
};
