import { Request, Response, NextFunction } from "express";
import { RedisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { ICacheConfig } from "../interfaces/response.interface";

export class CacheMiddleware {
	private static readonly redis = RedisClient.getInstance();

	static cache(config: ICacheConfig) {
		return async (
			req: Request,
			res: Response,
			next: NextFunction,
		): Promise<void> => {
			if (req.method !== "GET") {
				next();
			}

			const cacheKey = this.generateCacheKey(config.key, req);

			try {
				const cachedData = await this.redis.get(cacheKey);

				if (cachedData) {
					const data = JSON.parse(cachedData);
					res.json(data);
				}

				// Store the original res.json function
				const originalJson = res.json.bind(res);

				// Override res.json to cache the response
				res.json = ((data: any): Response => {
					res.json = originalJson;

					this.redis
						.setex(cacheKey, config.ttl, JSON.stringify(data))
						.catch(err => logger.error("Cache set error:", err));

					// If tags are provided, store the cache key with its tags
					if (config.tags?.length) {
						this.storeCacheKeyWithTags(cacheKey, config.tags).catch(
							err =>
								logger.error("Cache tag storage error:", err),
						);
					}

					return res.json(data);
				}) as any;

				next();
			} catch (error) {
				logger.error("Cache middleware error:", error);
				next();
			}
		};
	}

	static async invalidateCache(tags: string[]): Promise<void> {
		try {
			const keys = await this.getCacheKeysByTags(tags);
			if (keys.length > 0) {
				await this.redis.del(...keys);
				await this.removeCacheKeyTags(keys);
			}
		} catch (error) {
			logger.error("Cache invalidation error:", error);
		}
	}

	private static generateCacheKey(baseKey: string, req: Request): string {
		const queryString = Object.keys(req.query)
			.sort()
			.map(key => `${key}=${req.query[key]}`)
			.join("&");

		return `${baseKey}:${req.path}${queryString ? `:${queryString}` : ""}`;
	}

	private static async storeCacheKeyWithTags(
		key: string,
		tags: string[],
	): Promise<void> {
		const pipeline = this.redis.pipeline();

		tags.forEach(tag => {
			pipeline.sadd(`cache:tag:${tag}`, key);
		});

		await pipeline.exec();
	}

	private static async getCacheKeysByTags(tags: string[]): Promise<string[]> {
		const keys = await Promise.all(
			tags.map(tag => this.redis.smembers(`cache:tag:${tag}`)),
		);

		return Array.from(new Set(keys.flat()));
	}

	private static async removeCacheKeyTags(keys: string[]): Promise<void> {
		const pipeline = this.redis.pipeline();

		const tagKeys = await this.redis.keys("cache:tag:*");
		tagKeys.forEach(tagKey => {
			pipeline.srem(tagKey, ...keys);
		});

		await pipeline.exec();
	}
}
