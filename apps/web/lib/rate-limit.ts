import { LRUCache } from "lru-cache";

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

/**
 * Rate limiting utility for API endpoints
 * Uses LRU cache to store tokens and timestamps
 */
export function rateLimit(options: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1]);
          return resolve();
        }
        
        if (tokenCount[0] < limit) {
          tokenCache.set(token, [tokenCount[0] + 1]);
          return resolve();
        }

        reject(new Error("Rate limit exceeded"));
      }),
  };
} 