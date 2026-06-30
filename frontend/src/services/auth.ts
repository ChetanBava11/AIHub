import { api } from "../lib/api";
import type { MeResponse, OnboardingPayload } from "../types/auth";

type GoogleInitResponse = {
  url: string;
};

type OnboardingResponse = {
  tenant: MeResponse["user"]["tenant"];
};

export const authService = {
  async getMe() {
    const response = await api.get<MeResponse>("/me");
    return response.data;
  },

  async getGoogleConsentUrl() {
    const response = await api.get<GoogleInitResponse>("/auth/google/init");
    return response.data.url;
  },

  async completeOnboarding(payload: OnboardingPayload) {
    const response = await api.put<OnboardingResponse>("/tenant/onboarding", payload);
    return response.data.tenant;
  },

  async logout() {
    await api.post("/auth/logout");
  },
};
