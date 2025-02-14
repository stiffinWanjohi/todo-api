import Redis, { Redis as RedisType, RedisOptions } from "ioredis";
import { logger } from "../utils/logger";

export interface RedisConfig extends Partial<RedisOptions> {
	host: string;
	port: number;
	password?: string;
	db?: number;
	maxRetriesPerRequest?: number;
	enableReadyCheck?: boolean;
	lazyConnect?: boolean;
	showFriendlyErrorStack?: boolean;
}

const redisConfig: RedisConfig = {
	host: process.env.REDIS_HOST || "redis",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
	password: process.env.REDIS_PASSWORD,
	db: 0,
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	lazyConnect: true,
	showFriendlyErrorStack: process.env.NODE_ENV !== "production",
};

export class RedisClient {
	private static instance: RedisType | null = null;
	private static readonly retryStrategy = (times: number) => {
		const delay = Math.min(times * 50, 2000);
		logger.debug(
			`Retrying Redis connection, attempt #${times}, retry delay: ${delay}ms`,
		);
		return delay;
	};

	public static getInstance(
		config?: RedisConfig,
		retryStrategy?: number,
	): RedisType {
		if (!RedisClient.instance) {
			RedisClient.instance = new Redis({
				...(config || redisConfig),
				retryStrategy:
					retryStrategy !== undefined
						? (times: number) =>
								Math.min(times * retryStrategy, 2000)
						: RedisClient.retryStrategy,
			});

			RedisClient.instance.on("error", error => {
				logger.error("Redis connection error:", error);
			});

			RedisClient.instance.on("connect", () => {
				logger.info("Successfully connected to Redis");
			});

			RedisClient.instance.on("ready", () => {
				logger.info("Redis client ready");
			});

			RedisClient.instance.on("close", () => {
				logger.warn("Redis connection closed");
			});

			RedisClient.instance.on("reconnecting", (delay: number) => {
				logger.warn(`Redis is reconnecting... Retry delay: ${delay}ms`);
			});

			RedisClient.instance.on("end", () => {
				logger.info("Redis client has been disconnected");
			});
		}

		return RedisClient.instance;
	}

	// Graceful shutdown
	public static async disconnect(): Promise<void> {
		if (RedisClient.instance) {
			try {
				await RedisClient.instance.quit();
				logger.info("Redis connection closed gracefully");
			} catch (error) {
				logger.error("Error while disconnecting Redis:", error);
			} finally {
				RedisClient.instance = null;
			}
		}
	}
}
