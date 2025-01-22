import { Consumer, EachMessagePayload } from "kafkajs";
import { Redis } from "ioredis";
import { logger } from "../../utils/logger";
import { KafkaClient } from "../../config/kafka";
import { RedisClient } from "../../config/redis";
import { ITodo } from "../../interfaces/todo.interface";

export class TodoConsumer {
	private consumer: Consumer | undefined;
	private redis: Redis | undefined;
	private static instance: TodoConsumer;
	private readonly TODO_TOPIC = "todo-events";
	private readonly CONSUMER_GROUP = "todo-service-group";

	private constructor() {
		this.init();
	}

	private async init(): Promise<void> {
		this.consumer = await KafkaClient.getConsumer(this.CONSUMER_GROUP);
		this.redis = RedisClient.getInstance();
	}

	public static async getInstance(): Promise<TodoConsumer> {
		if (!TodoConsumer.instance) {
			TodoConsumer.instance = new TodoConsumer();
			await TodoConsumer.instance.init();
		}
		return TodoConsumer.instance;
	}

	private ensureConsumer(): Consumer {
		if (!this.consumer) {
			throw new Error("Consumer is not initialized");
		}
		return this.consumer;
	}

	private ensureRedis(): Redis {
		if (!this.redis) {
			throw new Error("Redis client is not initialized");
		}
		return this.redis;
	}

	async connect(): Promise<void> {
		try {
			const consumer = this.ensureConsumer();
			await consumer.subscribe({
				topic: this.TODO_TOPIC,
				fromBeginning: false,
			});
			logger.info("Successfully subscribed to Kafka topic");
		} catch (error) {
			logger.error("Failed to subscribe to Kafka topic:", error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		try {
			await KafkaClient.disconnect();
			await RedisClient.disconnect();
			logger.info("Successfully disconnected from Kafka and Redis");
		} catch (error) {
			logger.error("Failed to disconnect:", error);
			throw error;
		}
	}

	private async handleTodoEvent(
		eventType: string,
		todo: ITodo,
	): Promise<void> {
		const redis = this.ensureRedis();
		const cacheKey = `todo:${todo._id}`;

		try {
			switch (eventType) {
				case "created":
				case "updated":
					await redis.setex(
						cacheKey,
						3600, // 1 hour TTL
						JSON.stringify(todo),
					);
					break;

				case "deleted":
					await redis.del(cacheKey);
					break;

				default:
					logger.warn(`Unknown event type: ${eventType}`);
			}

			logger.info(
				`Successfully processed ${eventType} event for todo ${todo._id}`,
			);
		} catch (error) {
			logger.error(
				`Failed to process ${eventType} event for todo ${todo._id}:`,
				error,
			);
			throw error;
		}
	}

	async startConsuming(): Promise<void> {
		try {
			const consumer = this.ensureConsumer();
			await consumer.run({
				partitionsConsumedConcurrently: 3,
				eachMessage: async ({
					topic,
					partition,
					message,
				}: EachMessagePayload) => {
					try {
						if (!message.value) return;

						const eventData = JSON.parse(message.value.toString());
						const { eventType, todo } = eventData;

						await this.handleTodoEvent(eventType, todo);

						logger.debug("Processed message", {
							topic,
							partition,
							offset: message.offset,
							eventType,
							todoId: todo._id,
						});
					} catch (error) {
						logger.error("Error processing message:", error);
						await this.handleDeadLetter(message, error);
					}
				},
			});

			logger.info("Started consuming todo events");
		} catch (error) {
			logger.error("Failed to start consuming todo events:", error);
			throw error;
		}
	}

	async stopConsuming(): Promise<void> {
		try {
			const consumer = this.ensureConsumer();
			await consumer.stop();
			logger.info("Stopped consuming todo events");
		} catch (error) {
			logger.error("Failed to stop consuming todo events:", error);
			throw error;
		}
	}

	private async handleDeadLetter(message: any, error: any): Promise<void> {
		const deadLetterTopic = `${this.TODO_TOPIC}.deadletter`;
		const producer = await KafkaClient.getProducer();

		try {
			await producer.send({
				topic: deadLetterTopic,
				messages: [
					{
						value: JSON.stringify({
							originalMessage: message,
							error: {
								message: error.message,
								stack: error.stack,
							},
							timestamp: new Date().toISOString(),
						}),
					},
				],
			});
		} catch (dlqError) {
			logger.error(
				"Failed to send message to dead letter queue:",
				dlqError,
			);
		}
	}
}
