import request from "supertest";
import { createTestHarness } from "./support/testApp";

describe("refresh token rotation", () => {
  it("rotates a refresh token once and rejects reuse of the old token", async () => {
    const { app, authRepository, authService } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-456",
      email: "founder@example.com",
      name: "Founder"
    });
    const initialSession = await authService.issueSession(user);

    const firstRefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refresh_token=${initialSession.refreshToken}`]);

    expect(firstRefresh.status).toBe(200);
    const rawSetCookieHeaders = firstRefresh.headers["set-cookie"];
    const setCookieHeaders = Array.isArray(rawSetCookieHeaders)
      ? rawSetCookieHeaders
      : rawSetCookieHeaders
        ? [rawSetCookieHeaders]
        : [];
    const rotatedRefreshCookie = setCookieHeaders?.find((cookie: string) =>
      cookie.startsWith("refresh_token=")
    );

    expect(rotatedRefreshCookie).toBeDefined();
    if (!rotatedRefreshCookie) {
      throw new Error("Expected refresh cookie to be set after rotation.");
    }
    const rotatedRefreshToken = rotatedRefreshCookie.split(";")[0].split("=")[1];

    const replayedRefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refresh_token=${initialSession.refreshToken}`]);

    expect(replayedRefresh.status).toBe(401);
    expect(replayedRefresh.body.message).toMatch(/reuse detected/i);

    const revokedSessionAttempt = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refresh_token=${rotatedRefreshToken}`]);

    expect(revokedSessionAttempt.status).toBe(401);
  });
});
