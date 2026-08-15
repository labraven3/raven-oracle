import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";

export const securityMiddleware = [
  helmet(),
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
];
