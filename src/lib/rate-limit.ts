import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const redis = (redisUrl && redisToken && redisUrl.startsWith('https://') && !redisUrl.includes('...'))
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

// Create a new ratelimiter, that allows 10 requests per 1 hour
export const discoveryRatelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
}) : null;
