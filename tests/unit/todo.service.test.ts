import { Producer } from "kafkajs";
import { TodoProducer } from "../../src/events/producers/todo.producer";
import { KafkaClient } from "../../src/config/kafka";
import {
	ITodo,
	TodoPriority,
	TodoStatus,
} from "../../src/interfaces/todo.interface";

// Mock KafkaClient and its methods
jest.mock("../src/config/kafka", () => ({
	KafkaClient: {
		getProducer: jest.fn(),
		disconnect: jest.fn(),
	},
}));

describe("TodoProducer", () => {
	let mockKafkaProducer: jest.Mocked<Producer>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockKafkaProducer = {
			send: jest.fn(),
			sendBatch: jest.fn(),
			connect: jest.fn(),
			disconnect: jest.fn(),
		} as unknown as jest.Mocked<Producer>;

		(KafkaClient.getProducer as jest.Mock).mockResolvedValue(
			mockKafkaProducer,
		);
	});

	describe("Singleton Pattern", () => {
		it("should create only one instance of TodoProducer", () => {
			const instance1 = TodoProducer.getInstance();
			const instance2 = TodoProducer.getInstance();
			expect(instance1).toBe(instance2);
		});

		it("should initialize producer on first getInstance call", async () => {
			TodoProducer.getInstance();
			expect(KafkaClient.getProducer).toHaveBeenCalledTimes(1);
		});
	});

	describe("sendTodoEvent", () => {
		const mockTodo: ITodo = {
			_id: "123",
			title: "Test Todo",
			description: "Test Description",
			status: TodoStatus.PENDING,
			priority: TodoPriority.MEDIUM,
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: "user123",
			assignedTo: "user456",
			version: 1,
			dueDate: new Date(),
			tags: ["test"],
			isDeleted: false,
		};

		it("should successfully send a single todo event", async () => {
			const producer = TodoProducer.getInstance();
			await producer.sendTodoEvent("created", mockTodo);

			expect(mockKafkaProducer.send).toHaveBeenCalledWith({
				topic: "todo-events",
				messages: [
					expect.objectContaining({
						key: mockTodo._id,
						value: expect.any(String),
					}),
				],
			});

			const sentMessage = JSON.parse(
				(mockKafkaProducer.send as jest.Mock).mock.calls[0][0]
					.messages[0].value,
			);
			expect(sentMessage).toEqual({
				eventType: "created",
				todo: mockTodo,
				timestamp: expect.any(String),
			});
		});

		it("should throw error when todo has no _id", async () => {
			const producer = TodoProducer.getInstance();
			const invalidTodo = { ...mockTodo, _id: undefined };

			await expect(
				producer.sendTodoEvent("created", invalidTodo as ITodo),
			).rejects.toThrow("Todo must have an _id");
		});

		it("should throw error when producer fails to send", async () => {
			const producer = TodoProducer.getInstance();
			mockKafkaProducer.send.mockRejectedValueOnce(
				new Error("Kafka error"),
			);

			await expect(
				producer.sendTodoEvent("created", mockTodo),
			).rejects.toThrow("Kafka error");
		});
	});

	describe("sendBatchTodoEvents", () => {
		const mockTodos: Array<{
			eventType: "created" | "updated" | "deleted";
			todo: ITodo;
		}> = [
			{
				eventType: "created",
				todo: {
					_id: "123",
					title: "Todo 1",
					description: "Description 1",
					status: TodoStatus.PENDING,
					priority: TodoPriority.MEDIUM,
					createdAt: new Date(),
					updatedAt: new Date(),
					createdBy: "user123",
					assignedTo: "user456",
					version: 1,
					dueDate: new Date(),
					tags: ["test"],
					isDeleted: false,
				},
			},
			{
				eventType: "updated",
				todo: {
					_id: "456",
					title: "Todo 2",
					description: "Description 2",
					status: TodoStatus.COMPLETED,
					priority: TodoPriority.HIGH,
					createdAt: new Date(),
					updatedAt: new Date(),
					createdBy: "user789",
					assignedTo: "user012",
					version: 2,
					dueDate: new Date(),
					tags: ["test"],
					isDeleted: false,
				},
			},
		];

		it("should successfully send batch events", async () => {
			const producer = TodoProducer.getInstance();
			await producer.sendBatchTodoEvents(mockTodos);

			expect(mockKafkaProducer.sendBatch).toHaveBeenCalledWith({
				topicMessages: [
					{
						topic: "todo-events",
						messages: expect.arrayContaining([
							expect.objectContaining({
								key: expect.any(String),
								value: expect.any(String),
							}),
						]),
					},
				],
				timeout: 30000,
				compression: 2,
			});
		});

		it("should throw error when any todo in batch has no _id", async () => {
			const producer = TodoProducer.getInstance();
			const invalidTodos = [
				...mockTodos,
				{
					eventType: "created" as const,
					todo: { ...mockTodos[0].todo, _id: undefined },
				},
			];

			await expect(
				producer.sendBatchTodoEvents(invalidTodos),
			).rejects.toThrow("All todos must have an _id");
		});

		it("should throw error when batch send fails", async () => {
			const producer = TodoProducer.getInstance();
			mockKafkaProducer.sendBatch.mockRejectedValueOnce(
				new Error("Batch send failed"),
			);

			await expect(
				producer.sendBatchTodoEvents(mockTodos),
			).rejects.toThrow("Batch send failed");
		});
	});

	describe("disconnect", () => {
		it("should successfully disconnect from Kafka", async () => {
			const producer = TodoProducer.getInstance();
			await producer.disconnect();

			expect(KafkaClient.disconnect).toHaveBeenCalled();
		});

		it("should throw error when disconnect fails", async () => {
			const producer = TodoProducer.getInstance();
			(KafkaClient.disconnect as jest.Mock).mockRejectedValueOnce(
				new Error("Disconnect failed"),
			);

			await expect(producer.disconnect()).rejects.toThrow(
				"Disconnect failed",
			);
		});
	});
});