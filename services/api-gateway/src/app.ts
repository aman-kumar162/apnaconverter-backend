import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { jobsRouter } from "./routes/jobs.js";
import { toolsRouter } from "./routes/tools.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { config } from "./config.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = config.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);
      const localDev = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      callback(null, allowed.includes(origin) || localDev);
    },
    credentials: false,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "api-gateway" }));
  app.use("/api/tools", toolsRouter);
  app.use("/api/jobs", jobsRouter);
  app.use(errorHandler);
  return app;
}
