import { Producer } from "kafkajs";
import { TodoProducer } from "../../src/events/producers/todo.producer";
import { KafkaClient } from "../../src/config/kafka";
import {
	ITodo,
	TodoPriority,
	TodoStatus,
} from "../../src/interfaces/todo.interface";

jest.mock("../../src/config/kafka", () => ({
	KafkaClient: {
		getProducer: jest.fn(),
		disconnect: jest.fn(),
	},
}));

jest.mock("kafkajs", () => {
	return {
		Kafka: jest.fn().mockImplementation(() => ({
			producer: jest.fn().mockImplementation(() => ({
				connect: jest.fn().mockResolvedValue(true),
				send: jest.fn().mockResolvedValue(true),
				disconnect: jest.fn().mockResolvedValue(true),
			})),
		})),
	};
});

describe("TodoProducer", () => {
	let mockKafkaProducer: jest.Mocked<Producer>;
	const testDate = new Date("2025-01-21T22:20:20.642Z");

	beforeEach(() => {
		jest.clearAllMocks();
		(TodoProducer as any).instance = null;

		mockKafkaProducer = {
			send: jest.fn().mockResolvedValue(undefined),
			sendBatch: jest.fn().mockResolvedValue(undefined),
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<Producer>;

		(KafkaClient.getProducer as jest.Mock).mockResolvedValue(
			mockKafkaProducer,
		);
		(KafkaClient.disconnect as jest.Mock).mockResolvedValue(undefined);
	});

	afterAll(async () => {
		await mockKafkaProducer.disconnect();
	});

	const mockTodo: ITodo = {
		_id: "123",
		title: "Test Todo",
		description: "Test Description",
		status: TodoStatus.PENDING,
		priority: TodoPriority.MEDIUM,
		createdAt: testDate,
		updatedAt: testDate,
		createdBy: "user123",
		assignedTo: "user456",
		version: 1,
		dueDate: testDate,
		tags: ["test"],
		isDeleted: false,
	};

	describe("Singleton Pattern", () => {
		it("should create only one instance of TodoProducer", () => {
			const instance1 = TodoProducer.getInstance();
			const instance2 = TodoProducer.getInstance();
			expect(instance1).toBe(instance2);
		});

		it("should initialize producer on first operation", async () => {
			const producer = TodoProducer.getInstance();
			await producer.sendTodoEvent("created", mockTodo);
			expect(KafkaClient.getProducer).toHaveBeenCalledTimes(1);
		});

		it("should reuse producer for subsequent operations", async () => {
			const producer = TodoProducer.getInstance();
			await producer.sendTodoEvent("created", mockTodo);
			await producer.sendTodoEvent("updated", mockTodo);
			expect(KafkaClient.getProducer).toHaveBeenCalledTimes(1);
		});
	});

	describe("sendTodoEvent", () => {
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

			// Create expected to-do with stringified dates
			const expectedTodo = {
				...mockTodo,
				createdAt: mockTodo.createdAt?.toISOString(),
				updatedAt: mockTodo.updatedAt?.toISOString(),
				dueDate: mockTodo.dueDate?.toISOString(),
			};

			expect(sentMessage).toEqual({
				eventType: "created",
				todo: expectedTodo,
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
		const mockTodos = [
			{
				eventType: "created" as const,
				todo: {
					...mockTodo,
					_id: "123",
					title: "Todo 1",
				},
			},
			{
				eventType: "updated" as const,
				todo: {
					...mockTodo,
					_id: "456",
					title: "Todo 2",
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

			const sentBatch = (mockKafkaProducer.sendBatch as jest.Mock).mock
				.calls[0][0];
			const messages = sentBatch.topicMessages[0].messages;
			expect(messages.length).toBe(2);

			messages.forEach((msg: any, index: number) => {
				const parsedValue = JSON.parse(msg.value);
				// Create expected to-do with stringified dates
				const expectedTodo = {
					...mockTodos[index].todo,
					createdAt: testDate.toISOString(),
					updatedAt: testDate.toISOString(),
					dueDate: testDate.toISOString(),
				};

				expect(parsedValue).toEqual({
					eventType: mockTodos[index].eventType,
					todo: expectedTodo,
					timestamp: expect.any(String),
				});
			});
		});

		it("should throw error when any todo in batch has no _id", async () => {
			const producer = TodoProducer.getInstance();
			const invalidTodos = [
				...mockTodos,
				{
					eventType: "created" as const,
					todo: { ...mockTodo, _id: undefined },
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

		it("should allow reconnection after disconnect", async () => {
			const producer = TodoProducer.getInstance();
			await producer.sendTodoEvent("created", mockTodo);
			await producer.disconnect();
			await producer.sendTodoEvent("updated", mockTodo);

			expect(KafkaClient.getProducer).toHaveBeenCalledTimes(2);
		});
	});
});
