import express from "express";
import cors from "cors";
import { pino } from "pino";

import { config } from "./config.js";
import { HttpError } from "./lib/http-error.js";
import { authRouter } from "./routes/auth.routes.js";
import { eventsRouter } from "./routes/events.routes.js";
import { profilesRouter } from "./routes/profiles.routes.js";
import { scheduleSettingsRouter } from "./routes/schedule-settings.routes.js";
import { eventConfigsRouter } from "./routes/templates.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const logger = pino({ name: "api-request" });

export function createApp() {
  const app = express();
  const allowedOrigins = config.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(express.json());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new HttpError(403, "CORS origin not allowed"));
      }
    })
  );
  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, "incoming request");
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", profilesRouter);
  app.use("/api/v1", eventConfigsRouter);
  app.use("/api/v1", scheduleSettingsRouter);
  app.use("/api/v1", eventsRouter);

  app.use(errorHandler);

  return app;
}
