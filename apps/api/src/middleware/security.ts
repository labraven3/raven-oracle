import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";

// Production site origins plus localhost for local Next.js development.
const allowedOrigins = [
  env.WEB_ORIGIN,
  "https://www.ravenoracle.xyz",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

export const securityMiddleware = [
  helmet(),
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server calls).
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
