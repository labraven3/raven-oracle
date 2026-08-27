import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// Production site origins plus local Next.js development.
const allowedOrigins = [
  env.WEB_ORIGIN,
  "https://ravenoracle.xyz",
  "https://www.ravenoracle.xyz",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter((origin, index, list) => Boolean(origin) && list.indexOf(origin) === index);

const commonRateLimitOptions = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  skip: (req: { method: string }) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
};

export const apiWriteRateLimit = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 15 * 60 * 1000,
  limit: 180,
  message: { success: false, message: "Too many requests. Please try again shortly." },
});

export const authRateLimit = rateLimit({
  standardHeaders: "draft-8",
  legacyHeaders: false,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { success: false, message: "Too many authentication attempts. Please try again later." },
});

export const securityMiddleware = [
  helmet({
    hsts: env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
  apiWriteRateLimit,
];
