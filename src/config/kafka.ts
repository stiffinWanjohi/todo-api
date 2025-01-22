import { Kafka, Producer, Consumer, SASLOptions } from "kafkajs";
import { logger } from "../utils/logger";

export interface KafkaClientConfig {
	clientId: string;
	brokers: string[];
	ssl?: boolean;
	sasl?: SASLOptions;
}

const kafkaConfig: KafkaClientConfig = {
	clientId: process.env.KAFKA_CLIENT_ID || "todo-api",
	brokers: (process.env.KAFKA_BROKER || "localhost:9092").split(","),
	...(process.env.KAFKA_SSL === "true" && {
		ssl: true,
		sasl: {
			mechanism: "plain" as const,
			username: process.env.KAFKA_USERNAME || "",
			password: process.env.KAFKA_PASSWORD || "",
		},
	}),
};

export class KafkaClient {
	private static instance: Kafka | null = null;
	private static producer: Producer | null = null;
	private static consumers: Map<string, Consumer> = new Map();

	public static getInstance(): Kafka {
		if (!KafkaClient.instance) {
			KafkaClient.instance = new Kafka({
				...kafkaConfig,
				sasl: kafkaConfig.sasl,
			});
		}
		return KafkaClient.instance;
	}

	public static async getProducer(): Promise<Producer> {
		if (!KafkaClient.producer) {
			KafkaClient.producer = KafkaClient.getInstance().producer({
				allowAutoTopicCreation: true,
				transactionTimeout: 30000,
			});
			await KafkaClient.producer.connect();
			logger.info("Kafka producer connected");
		}
		return KafkaClient.producer;
	}

	public static async getConsumer(groupId: string): Promise<Consumer> {
		if (!KafkaClient.consumers.has(groupId)) {
			const consumer = KafkaClient.getInstance().consumer({
				groupId,
				maxWaitTimeInMs: 100,
				maxBytes: 5242880, // 5MB
				readUncommitted: false,
			});

			await consumer.connect();
			KafkaClient.consumers.set(groupId, consumer);
			logger.info(`Kafka consumer connected for group ${groupId}`);
		}
		return KafkaClient.consumers.get(groupId) as Consumer;
	}

	public static async disconnect(): Promise<void> {
		if (KafkaClient.producer) {
			await KafkaClient.producer.disconnect();
			KafkaClient.producer = null;
		}

		for (const [groupId, consumer] of KafkaClient.consumers) {
			await consumer.disconnect();
			KafkaClient.consumers.delete(groupId);
			logger.info(`Kafka consumer disconnected for group ${groupId}`);
		}

		KafkaClient.instance = null;
		logger.info("Kafka client disconnected");
	}
}
