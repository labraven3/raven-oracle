import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";

// Allow both configured WEB_ORIGIN and localhost (for Next.js rewrite proxy)
// Also allow production IPs for direct browser access
const allowedOrigins = [
  env.WEB_ORIGIN,
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://3.235.129.163:3001",
];

export const securityMiddleware = [
  helmet(),
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, Postman, or same-origin via Next.js rewrite)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
];
