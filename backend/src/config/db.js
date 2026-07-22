import mongoose from "mongoose";

/**
 * Per-process connection pool size.
 *
 * Atlas (and most managed Mongo) caps total connections per cluster. When we
 * cluster the API (N workers × M instances) the effective pool is N*M*poolSize.
 *
 * Default 25 keeps a fully scaled-out fleet (e.g. 8 workers × 10 instances =
 * 80 processes × 25 = 2000 connections) inside the M30/M40 limits.
 * Override per-environment via MONGO_POOL_SIZE.
 */
const DEFAULT_POOL_SIZE = 25;

export async function connectDB() {
  const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/coxa";
  const poolSize = Number(process.env.MONGO_POOL_SIZE) || DEFAULT_POOL_SIZE;

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    maxPoolSize: poolSize,
    minPoolSize: Math.min(5, poolSize),
    // Atlas closes idle sockets at 10min; drop ours sooner so we never reuse a half-dead one.
    maxIdleTimeMS: 60_000,
    // Fail fast under load instead of stacking up callers behind a wedged primary.
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  });
  console.log(`[mongodb] connected (pool=${poolSize}): ${uri.replace(/\/\/.*@/, "//***@")}`);
}

export function disconnectDB() {
  return mongoose.disconnect();
}
