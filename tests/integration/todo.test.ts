import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app";
import { TodoModel } from "../../src/models/todo.model";
import { RedisClient } from "../../src/config/redis";
import { TodoProducer } from "../../src/events/producers/todo.producer";
import { TodoConsumer } from "../../src/events/consumers/todo.consumer";
import { HttpStatus } from "../../src/utils/error-codes";
import { ITodo, TodoStatus } from "../../src/interfaces/todo.interface";

describe("Todo API Integration Tests", () => {
	let producer: TodoProducer;
	let consumer: TodoConsumer;

    const BASE_ROUTE = "/api/v1/todos";

	beforeAll(async () => {
		await mongoose.connect(
			process.env.MONGODB_TEST_URI ||
				"mongodb://localhost:27017/todo-test",
		);
		await TodoModel.deleteMany({});
		await RedisClient.getInstance().flushall();

		producer = TodoProducer.getInstance();
		consumer = TodoConsumer.getInstance();
		await consumer.connect();
		await consumer.startConsuming();
	});

	afterAll(async () => {
		await mongoose.disconnect();
		await RedisClient.getInstance().quit();
		await producer.disconnect();
		await consumer.disconnect();
	});

	beforeEach(async () => {
		await TodoModel.deleteMany({});
	});

    describe("Health Route", () => {
        it("should return health status", async () => {
            const response = await request(app.getApp())
                .get("/health")
                .expect(HttpStatus.OK);

            expect(response.body.status).toBe("ok");
        });
    });

	describe(`POST ${BASE_ROUTE}`, () => {
		const validTodo = {
			title: "Integration Test Todo",
			description: "Testing the API endpoints",
			dueDate: new Date().toISOString(),
			priority: "high",
			status: "pending",
		};

		it("should create a new todo", async () => {
			const response = await request(app.getApp())
				.post(`${BASE_ROUTE}`)
				.send(validTodo)
				.expect(HttpStatus.CREATED);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toMatchObject({
				title: validTodo.title,
				description: validTodo.description,
				priority: validTodo.priority,
				status: validTodo.status,
			});
		});

		it("should validate required fields", async () => {
			const invalidTodo = { title: "" };
			const response = await request(app.getApp())
				.post(BASE_ROUTE)
				.send(invalidTodo)
				.expect(HttpStatus.BAD_REQUEST);

			expect(response.body.success).toBe(false);
		});
	});

	describe(`GET ${BASE_ROUTE}`, () => {
		beforeEach(async () => {
			const todos = [
				{
					title: "Todo 1",
					status: "pending",
					priority: "high",
					dueDate: new Date(),
				},
				{
					title: "Todo 2",
					status: "completed",
					priority: "low",
					dueDate: new Date(),
				},
			];
			await TodoModel.insertMany(todos);
		});

		it("should get todos with pagination", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}?page=1&limit=10`)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.headers["x-total-count"]).toBeDefined();
			expect(response.headers["x-total-pages"]).toBeDefined();
		});

		it("should filter todos by status", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}?status=pending`)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(
				response.body.data.every(
					(todo: ITodo) => todo.status === TodoStatus.PENDING,
				),
			).toBe(true);
		});

		it("should validate date range parameters", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}?startDate=invalid-date`)
				.expect(HttpStatus.BAD_REQUEST);

			expect(response.body.success).toBe(false);
		});
	});

	describe(`GET ${BASE_ROUTE}/:id`, () => {
		let todoId: string;

		beforeEach(async () => {
			const todo = await TodoModel.create({
				title: "Test Todo",
				status: "pending",
				priority: "high",
			});
			todoId = todo._id.toString();
		});

		it("should get a todo by id", async () => {
			const response = await request(app.getApp())
				.get(`${BASE_ROUTE}/${todoId}`)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(response.body.data._id).toBe(todoId);
		});

		it("should return 404 for non-existent todo", async () => {
			const fakeId = new mongoose.Types.ObjectId().toString();
			await request(app.getApp())
				.get(`/api/todos/${fakeId}`)
				.expect(HttpStatus.NOT_FOUND);
		});
	});

	describe(`PUT ${BASE_ROUTE}/:id`, () => {
		let todoId: string;

		beforeEach(async () => {
			const todo = await TodoModel.create({
				title: "Test Todo",
				status: "pending",
				priority: "high",
			});
			todoId = todo._id.toString();
		});

		it("should update a todo", async () => {
			const updateData = {
				title: "Updated Todo",
				status: "completed",
			};

			const response = await request(app.getApp())
				.put(`${BASE_ROUTE}/${todoId}`)
				.send(updateData)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(response.body.data.title).toBe(updateData.title);
			expect(response.body.data.status).toBe(updateData.status);
		});
	});

	describe(`DELETE ${BASE_ROUTE}/:id`, () => {
		let todoId: string;

		beforeEach(async () => {
			const todo = await TodoModel.create({
				title: "Test Todo",
				status: "pending",
				priority: "high",
			});
			todoId = todo._id.toString();
		});

		it("should delete a todo", async () => {
			await request(app.getApp())
				.delete(`${BASE_ROUTE}/${todoId}`)
				.expect(HttpStatus.NO_CONTENT);

			const deletedTodo = await TodoModel.findById(todoId);
			expect(deletedTodo).toBeNull();
		});
	});

	describe(`PATCH ${BASE_ROUTE}/bulk`, () => {
		let todoIds: string[];

		beforeEach(async () => {
			const todos = await TodoModel.insertMany([
				{ title: "Todo 1", status: "pending", priority: "high" },
				{ title: "Todo 2", status: "pending", priority: "medium" },
			]);
			todoIds = todos.map(todo => todo._id.toString());
		});

		it("should bulk update todos", async () => {
			const updateData = {
				ids: todoIds,
				update: { status: "completed" },
			};

			const response = await request(app.getApp())
				.patch(`${BASE_ROUTE}/bulk`)
				.send(updateData)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(response.body.data.updatedCount).toBe(todoIds.length);

			const updatedTodos = await TodoModel.find({
				_id: { $in: todoIds },
			});
			expect(
				updatedTodos.every(
					todo => todo.status === TodoStatus.COMPLETED,
				),
			).toBe(true);
		});
	});

	describe(`POST ${BASE_ROUTE}/:id/restore`, () => {
		let todoId: string;

		beforeEach(async () => {
			const todo = await TodoModel.create({
				title: "Test Todo",
				status: "pending",
				priority: "high",
				deleted: true,
				deletedAt: new Date(),
			});
			todoId = todo._id.toString();
		});

		it("should restore a deleted todo", async () => {
			const response = await request(app.getApp())
				.post(`${BASE_ROUTE}/${todoId}/restore`)
				.expect(HttpStatus.OK);

			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toBe(
				"Todo restored successfully",
			);

			const restoredTodo = await TodoModel.findById(todoId);
			expect(restoredTodo?.isDeleted).toBe(false);
		});
	});
});