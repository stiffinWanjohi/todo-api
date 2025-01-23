import mongoose from "mongoose";
import request from "supertest";
import app from "../../src/app";
import { TodoModel } from "../../src/models/todo.model";
import {
	ITodo,
	TodoPriority,
	TodoStatus,
} from "../../src/interfaces/todo.interface";
import { clearDB, closeDB, connectDB } from "../../src/config/database";
import { RedisClient } from "../../src/config/redis";

// Mock Kafka producer
jest.mock("../../src/config/kafka", () => {
    const mockProducer = {
        connect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        transaction: jest.fn().mockImplementation(() => ({
            init: jest.fn().mockResolvedValue(undefined),
            send: jest.fn().mockResolvedValue({ success: true }),
            commit: jest.fn().mockResolvedValue(undefined),
            abort: jest.fn().mockResolvedValue(undefined),
            sendOffsets: jest.fn().mockResolvedValue(undefined),
        })),
    };

    return {
        KafkaClient: {
            producer: mockProducer,
            getProducer: jest.fn().mockResolvedValue(mockProducer),
            getInstance: jest.fn().mockReturnValue({
                producer: jest.fn().mockReturnValue(mockProducer),
            }),
            isConnected: jest.fn().mockReturnValue(true),
        },
    };
});

// Mock redis client
jest.mock("../../src/config/redis", () => {
    const mockRedisInstance = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        setex: jest.fn().mockResolvedValue("OK"),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue("OK"),
        pipeline: jest.fn().mockReturnValue({
            sadd: jest.fn().mockReturnThis(),
            srem: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
        }),
        keys: jest.fn().mockResolvedValue([]),
        smembers: jest.fn().mockResolvedValue([]),
        on: jest.fn().mockImplementation((event, callback) => {
            if (event === "connect" || event === "ready") {
                callback();
            }
            return mockRedisInstance;
        }),
    };

    return {
        RedisClient: {
            instance: null,
            getInstance: jest.fn().mockReturnValue(mockRedisInstance),
            disconnect: jest.fn().mockImplementation(async () => {
                await mockRedisInstance.quit();
            }),
        },
    };
});

describe("Todo Integration Tests", () => {
	const BASE_ROUTE = "/api/v1/todos";
	let createdTodoId: string;
	const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

	beforeAll(async () => {
		try {
            await connectDB(
                process.env.MONGODB_URI || "mongodb://localhost:27017/todo-test",
            );
            await mongoose.connection.asPromise();

            // Initialize Redis mock
            RedisClient.getInstance({
                host: "localhost",
                port: 6379,
                lazyConnect: true,
            });

            app.setDatabase(mongoose.connection);
            app.setupRoutes();
            app.setupErrorHandling();
            await clearDB();

            // Create a test todo for subsequent tests
            const testTodo = await TodoModel.create({
                title: "Integration Test Todo",
                description: "Testing the create endpoint",
                dueDate: new Date().toISOString(),
                priority: TodoPriority.HIGH,
                status: TodoStatus.PENDING,
                tags: ["documentation", "api"],
                assignedTo: "user123",
                createdBy: TEST_USER_ID,
            });
            createdTodoId = testTodo._id.toString();
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
	});

	afterAll(async () => {
        await RedisClient.disconnect();
		await clearDB();
		await closeDB();
	});

	describe(`POST ${BASE_ROUTE}`, () => {
		it("should create a new todo", async () => {
            const todoData = {
                title: "Integration Test Todo",
                description: "Testing the create endpoint",
                dueDate: new Date().toISOString(),
                priority: TodoPriority.HIGH,
                status: TodoStatus.PENDING,
                tags: ["documentation", "api"],
                assignedTo: "user123",
                createdBy: TEST_USER_ID,
            };

            const response = await request(app.getApp())
                .post(`${BASE_ROUTE}`)
                .send(todoData)
                .expect(201);

            expect(response.body.data).toHaveProperty("_id");
            expect(response.body.data.title).toBe(todoData.title);
        });

		it("should fail to create todo with invalid data", async () => {
			const invalidTodo = {
				description: "Missing required title",
			};

			await request(app.getApp())
				.post(`${BASE_ROUTE}`)
				.send(invalidTodo)
				.expect(400);
		});
	});

	describe(`GET ${BASE_ROUTE}`, () => {
		it("should get todos with pagination", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}`)
				.query({ page: 1, limit: 10 })
				.expect(200);

			expect(response.body.data).toBeInstanceOf(Array);
			expect(response.headers).toHaveProperty("x-total-count");
			expect(response.headers).toHaveProperty("x-total-pages");
		});

		it("should filter todos by status", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}`)
				.query({ status: TodoStatus.PENDING })
				.expect(200);

			response.body.data.forEach((todo: ITodo) => {
				expect(todo.status).toBe(TodoStatus.PENDING);
			});
		});

		it("should sort todos", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}`)
				.query({ sortBy: "dueDate", sortOrder: "desc" })
				.expect(200);

			expect(response.body.data).toBeInstanceOf(Array);
		});
	});

	describe(`GET ${BASE_ROUTE}/:id`, () => {
		it("should get a specific todo by id", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}/${createdTodoId}`)
				.expect(200);

			expect(response.body.data._id).toBe(createdTodoId);
		});

		it("should return 404 for non-existent todo", async () => {
			await request(app.getApp())
				.get(`${BASE_ROUTE}/654321654321654321654321`)
				.expect(404);
		});
	});

	describe(`PUT ${BASE_ROUTE}/:id`, () => {
		it("should update a todo", async () => {
			const updateData = {
				title: "Updated Integration Test Todo",
				status: TodoStatus.COMPLETED,
                version: 1,
			};

			const response = await request(app.getApp())
				.put(`${BASE_ROUTE}/${createdTodoId}`)
				.send(updateData)
				.expect(200);

			expect(response.body.data.title).toBe(updateData.title);
			expect(response.body.data.status).toBe(updateData.status);
		});
	});

	describe(`DELETE ${BASE_ROUTE}/:id`, () => {
		it("should soft delete a todo", async () => {
			await request(app.getApp())
				.delete(`${BASE_ROUTE}/${createdTodoId}`)
				.expect(200);

			// Verify the todo is soft deleted
			await request(app.getApp())
				.get(`${BASE_ROUTE}/${createdTodoId}`)
				.expect(404);
		});
	});

	describe(`POST ${BASE_ROUTE}/bulk-update`, () => {
		let todoIds: string[] = [];

		beforeEach(async () => {
			await TodoModel.deleteMany({ _id: { $in: todoIds } });

			const todos = await TodoModel.create([
				{
					title: "Bulk Todo 1",
					status: TodoStatus.PENDING,
					description: "Test Description",
					dueDate: new Date(),
					priority: TodoPriority.HIGH,
					isDeleted: false,
					createdBy: TEST_USER_ID,
				},
				{
					title: "Bulk Todo 2",
					status: TodoStatus.PENDING,
					description: "Test Description",
					dueDate: new Date(),
					priority: TodoPriority.HIGH,
					isDeleted: false,
					createdBy: TEST_USER_ID,
				},
			]);
			todoIds = todos.map(todo => todo._id.toString());
		});

		afterEach(async () => {
			await TodoModel.deleteMany({ _id: { $in: todoIds } });
		});

		it("should bulk update multiple todos", async () => {
			const bulkUpdateData = {
				ids: todoIds,
				update: {
					status: TodoStatus.COMPLETED,
				},
			};

			const response = await request(app.getApp())
				.post(`${BASE_ROUTE}/bulk-update`)
				.send(bulkUpdateData)
				.expect(200);

			expect(response.body.data.updatedCount).toBe(todoIds.length);
		});
	});

	describe(`POST ${BASE_ROUTE}/:id/restore`, () => {
		it("should restore a deleted todo", async () => {
            // First create
            const testTodo = await TodoModel.create({
                title: "Integration Test Todo",
                description: "Testing the create endpoint",
                dueDate: new Date().toISOString(),
                priority: TodoPriority.HIGH,
                status: TodoStatus.PENDING,
                tags: ["documentation", "api"],
                assignedTo: "user123",
                createdBy: TEST_USER_ID,
            });
            createdTodoId = testTodo._id.toString();

			// Then delete the todo
			await request(app.getApp())
				.delete(`${BASE_ROUTE}/${createdTodoId}`)
				.expect(200);

			// Then restore it
			await request(app.getApp())
				.post(`${BASE_ROUTE}/${createdTodoId}/restore`)
				.expect(200);

			// Verify the todo is accessible again
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}/${createdTodoId}`)
				.expect(200);

			expect(response.body.data._id).toBe(createdTodoId);
		});
	});

	describe(`GET ${BASE_ROUTE}/statistics`, () => {
		it("should get todo statistics", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}/statistics`)
				.expect(200);

			expect(response.body.data).toHaveProperty("totalTodos");
			expect(response.body.data).toHaveProperty("completedTodos");
			expect(response.body.data).toHaveProperty("pendingTodos");
			expect(response.body.data).toHaveProperty("inProgressTodos");
			expect(response.body.data).toHaveProperty("highPriorityTodos");
			expect(response.body.data).toHaveProperty("overdueTodos");
		});
	});
});
