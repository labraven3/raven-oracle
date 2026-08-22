import type { NextFunction, Request, RequestHandler, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function simpleRateLimit(options: {
  windowMs: number;
  max: number;
  message: string;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.windowMs}:${options.max}:${req.method}:${req.baseUrl}${req.path}:${clientKey(req)}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ success: false, message: options.message });
    }

    return next();
  };
}

const CLEANUP_INTERVAL = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL).unref();
