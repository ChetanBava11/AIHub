import jwt from "jsonwebtoken";
import request from "supertest";
import { env } from "../src/config/env";
import { signAccessToken } from "../src/lib/jwt";
import { createTestHarness } from "./support/testApp";

describe("requireAuth middleware", () => {
  it("rejects requests with no access token cookie", async () => {
    const { app } = createTestHarness();

    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/authentication required/i);
  });

  it("rejects requests with an invalid access token cookie", async () => {
    const { app } = createTestHarness();

    const response = await request(app)
      .get("/me")
      .set("Cookie", ["access_token=not-a-real-jwt"]);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid|expired/i);
  });

  it("rejects requests with an expired access token cookie", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-123",
      email: "owner@example.com",
      name: "Owner"
    });
    const expiredToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId
      },
      env.JWT_SECRET,
      { expiresIn: -1 }
    );

    const response = await request(app)
      .get("/me")
      .set("Cookie", [`access_token=${expiredToken}`]);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid|expired/i);
  });

  it("allows requests with a valid access token cookie", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-789",
      email: "member@example.com",
      name: "Member"
    });
    const validToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId
    });

    const response = await request(app)
      .get("/me")
      .set("Cookie", [`access_token=${validToken}`]);

    expect(response.status).toBe(200);
  });
});
