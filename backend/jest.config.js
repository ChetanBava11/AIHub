/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts", "!src/types/**/*.d.ts"]
};
