import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach } from "vitest";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.API_PORT = "3001";
  process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  process.env.JWT_REFRESH_SECRET = "b".repeat(32);
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.SCHEDULER_SERVICE_URL = "http://scheduler.mock";
  process.env.AWS_REGION = "us-east-1";
  process.env.SES_FROM_EMAIL = "reminders@example.com";

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri("reward_scheduler_test");

  await mongoose.connect(process.env.MONGODB_URI);
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
