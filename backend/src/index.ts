import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./lib/mongo";
import { prisma } from "./prisma/client";

const start = async () => {
  await prisma.$connect();
  await connectMongo();

  const app = createApp();

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start backend.", error);
  process.exit(1);
});
