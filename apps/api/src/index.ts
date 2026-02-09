import { pino } from "pino";

import { config } from "./config.js";
import { createApp } from "./app.js";
import { connectDatabase } from "./db/connect.js";
import { closeReminderQueue } from "./services/reminder-queue.js";

const logger = pino({ name: "reward-api" });

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.API_PORT, () => {
    logger.info({ port: config.API_PORT }, "API server listening");
  });

  const shutdown = async () => {
    logger.info("Shutting down API server");
    await closeReminderQueue();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error({ error }, "API boot failed");
  process.exit(1);
});
