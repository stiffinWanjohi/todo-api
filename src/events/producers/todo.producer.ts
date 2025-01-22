import { Message, Producer } from "kafkajs";
import { logger } from "../../utils/logger";
import { KafkaClient } from "../../config/kafka";
import { ITodo } from "../../interfaces/todo.interface";

export class TodoProducer {
	private producer: Producer | null = null;
	private static instance: TodoProducer | null = null;
	private readonly TODO_TOPIC = "todo-events";
	private initialized = false;

	private constructor() {}

	public static getInstance(): TodoProducer {
		if (!TodoProducer.instance) {
			TodoProducer.instance = new TodoProducer();
		}
		return TodoProducer.instance;
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			try {
				this.producer = await KafkaClient.getProducer();
				this.initialized = true;
			} catch (error) {
				logger.error("Failed to initialize producer:", error);
				throw error;
			}
		}
	}

	private ensureProducer(): Producer {
		if (!this.producer) {
			throw new Error("Producer not initialized");
		}
		return this.producer;
	}

	async disconnect(): Promise<void> {
		try {
			await KafkaClient.disconnect();
			this.producer = null;
			this.initialized = false;
			logger.info("Successfully disconnected from Kafka producer");
		} catch (error) {
			logger.error("Failed to disconnect from Kafka producer:", error);
			throw error;
		}
	}

	async sendTodoEvent(
		eventType: "created" | "updated" | "deleted",
		todo: ITodo,
	): Promise<void> {
		await this.ensureInitialized();

		if (!todo._id) {
			throw new Error("Todo must have an _id");
		}

		const producer = this.ensureProducer();
		const message: Message = {
			key: todo._id.toString(),
			value: JSON.stringify({
				eventType,
				todo,
				timestamp: new Date().toISOString(),
			}),
		};

		try {
			await producer.send({
				topic: this.TODO_TOPIC,
				messages: [message],
			});

			logger.info(
				`Successfully sent ${eventType} event for todo ${todo._id}`,
			);
		} catch (error) {
			logger.error(
				`Failed to send ${eventType} event for todo ${todo._id}:`,
				error,
			);
			throw error;
		}
	}

	async sendBatchTodoEvents(
		events: Array<{
			eventType: "created" | "updated" | "deleted";
			todo: ITodo;
		}>,
	): Promise<void> {
		await this.ensureInitialized();
		const producer = this.ensureProducer();

		const invalidTodos = events.filter(event => !event.todo._id);
		if (invalidTodos.length > 0) {
			throw new Error("All todos must have an _id");
		}

		const messages: Message[] = events.map(event => ({
			key: event.todo._id!.toString(),
			value: JSON.stringify({
				eventType: event.eventType,
				todo: event.todo,
				timestamp: new Date().toISOString(),
			}),
		}));

		try {
			await producer.sendBatch({
				topicMessages: [
					{
						topic: this.TODO_TOPIC,
						messages,
					},
				],
				timeout: 30000,
				compression: 2, // Use Snappy compression
			});

			logger.info(
				`Successfully sent batch of ${events.length} todo events`,
			);
		} catch (error) {
			logger.error("Failed to send batch todo events:", error);
			throw error;
		}
	}
}
