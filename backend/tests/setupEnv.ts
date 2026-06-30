process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "4000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ai_business_ops_test";
process.env.MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017/ai_business_ops_test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret-12345";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "test-client-secret";
process.env.GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:4000/auth/google/callback";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET ?? "test-cookie-secret-12345";
