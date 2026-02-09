import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const commonNodeSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),
  SCHEDULER_SERVICE_URL: z.string().url(),
  AWS_REGION: z.string().min(1),
  SES_FROM_EMAIL: z.string().email()
});

export type CommonNodeConfig = z.infer<typeof commonNodeSchema>;

const apiSchema = commonNodeSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z.string().default("http://localhost:5173")
});

const workerSchema = commonNodeSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5)
});

const webSchema = z.object({
  VITE_API_BASE_URL: z.string().url()
});

const schedulerSchema = z.object({
  SCHEDULER_PORT: z.coerce.number().int().positive().default(8000)
});

export type ApiConfig = z.infer<typeof apiSchema>;
export type WorkerConfig = z.infer<typeof workerSchema>;
export type WebConfig = z.infer<typeof webSchema>;
export type SchedulerConfig = z.infer<typeof schedulerSchema>;

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  return apiSchema.parse(env);
}

export function loadWorkerConfig(env: Record<string, string | undefined> = process.env): WorkerConfig {
  return workerSchema.parse(env);
}

export function loadWebConfig(env: Record<string, string | undefined> = process.env): WebConfig {
  return webSchema.parse(env);
}

export function loadSchedulerConfig(
  env: Record<string, string | undefined> = process.env
): SchedulerConfig {
  return schedulerSchema.parse(env);
}
