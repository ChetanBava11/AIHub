import mongoose from "mongoose";
import { env } from "../config/env";

let mongoConnectionPromise: Promise<typeof mongoose> | null = null;

export const connectMongo = async (): Promise<typeof mongoose> => {
  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(env.MONGO_URL);
  }

  return mongoConnectionPromise;
};
