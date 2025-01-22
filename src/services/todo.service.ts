import { ClientSession, SortOrder } from "mongoose";
import { TodoModel } from "../models/todo.model";
import {
	ITodo,
	ITodoCreate,
	ITodoUpdate,
	ITodoQuery,
	TodoStatus,
} from "../interfaces/todo.interface";
import { IPaginatedResponse } from "../interfaces/response.interface";
import { RedisClient } from "../config/redis";
import { KafkaClient } from "../config/kafka";
import { logger } from "../utils/logger";
import { AppError, ErrorCodes, HttpStatus } from "../utils/error-codes";

export class TodoService {
	private readonly cacheClient = RedisClient.getInstance();
	private readonly CACHE_TTL = 3600; // 1 hour
	private readonly CACHE_PREFIX = "todo:";
	private readonly KAFKA_TOPIC = "todo-events";

	private getCacheKey(id: string): string {
		return `${this.CACHE_PREFIX}${id}`;
	}

	private async publishEvent(type: string, payload: any): Promise<void> {
		try {
			const producer = await KafkaClient.getProducer();
			await producer.send({
				topic: this.KAFKA_TOPIC,
				messages: [
					{
						key: payload._id?.toString() || "default",
						value: JSON.stringify({ type, payload }),
						timestamp: Date.now().toString(),
					},
				],
			});
			logger.info(`Event published successfully: ${type}`, { payload });
		} catch (error) {
			logger.error(`Failed to publish event: ${type}`, {
				error,
				payload,
			});
			throw new AppError(
				ErrorCodes.EVENT_PUBLISH_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to publish event",
			);
		}
	}

	private async cacheGet(key: string): Promise<ITodo | null> {
		try {
			const cached = await this.cacheClient.get(key);
			return cached ? JSON.parse(cached) : null;
		} catch (error) {
			logger.error("Cache get error:", { error, key });
			throw new AppError(
				ErrorCodes.CACHE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get data from cache",
			);
		}
	}

	private async cacheSet(key: string, value: ITodo): Promise<void> {
		try {
			await this.cacheClient.setex(
				key,
				this.CACHE_TTL,
				JSON.stringify(value),
			);
		} catch (error) {
			logger.error("Cache set error:", { error, key });
			throw new AppError(
				ErrorCodes.CACHE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to set data in cache",
			);
		}
	}

	private async cacheDelete(key: string): Promise<void> {
		try {
			await this.cacheClient.del(key);
		} catch (error) {
			logger.error("Cache delete error:", { error, key });
			throw new AppError(
				ErrorCodes.CACHE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to delete data from cache",
			);
		}
	}

	async create(data: ITodoCreate, _session?: ClientSession): Promise<ITodo> {
		try {
			const todo = new TodoModel(data);
			await todo.save();

			await this.publishEvent("TODO_CREATED", todo);
			await this.cacheSet(this.getCacheKey(todo._id), todo.toJSON());

			return todo;
		} catch (error) {
			logger.error("Failed to create todo:", error);
			throw new AppError(
				ErrorCodes.DATABASE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create todo",
			);
		}
	}

	async findById(id: string): Promise<ITodo> {
		const cacheKey = this.getCacheKey(id);
		const cached = await this.cacheGet(cacheKey);

		if (cached) {
			return cached;
		}

		const todo = await TodoModel.findOne({ _id: id, isDeleted: false });
		if (!todo) {
			throw new AppError(
				ErrorCodes.RESOURCE_NOT_FOUND,
				HttpStatus.NOT_FOUND,
				"Todo not found",
			);
		}

		await this.cacheSet(cacheKey, todo.toJSON());
		return todo;
	}

	async update(
		id: string,
		data: ITodoUpdate,
		_session?: ClientSession,
	): Promise<ITodo> {
		const todo = await TodoModel.findOneAndUpdate(
			{
				_id: id,
				isDeleted: false,
				version: data.version,
			},
			{
				...data,
				version: data.version + 1,
				...(data.status === TodoStatus.COMPLETED
					? { completedAt: new Date() }
					: {}),
			},
			{
				new: true,
				runValidators: true,
			},
		);

		if (!todo) {
			throw new AppError(
				ErrorCodes.TODO_VERSION_CONFLICT,
				HttpStatus.CONFLICT,
				"Todo was updated by another request",
			);
		}

		await this.publishEvent("TODO_UPDATED", todo);
		await this.cacheSet(this.getCacheKey(id), todo.toJSON());

		return todo;
	}

	async delete(id: string, _session?: ClientSession): Promise<void> {
		const todo = await TodoModel.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ isDeleted: true },
		);

		if (!todo) {
			throw new AppError(
				ErrorCodes.RESOURCE_NOT_FOUND,
				HttpStatus.NOT_FOUND,
				"Todo not found",
			);
		}

		await this.publishEvent("TODO_DELETED", { id });
		await this.cacheDelete(this.getCacheKey(id));
	}

	async restore(id: string, _session?: ClientSession): Promise<void> {
		const todo = await TodoModel.findOneAndUpdate(
			{ _id: id, isDeleted: true },
			{ isDeleted: false },
		);

		if (!todo) {
			throw new AppError(
				ErrorCodes.RESOURCE_NOT_FOUND,
				HttpStatus.NOT_FOUND,
				"Todo not found or already active",
			);
		}

		await this.publishEvent("TODO_RESTORED", todo);
		await this.cacheSet(this.getCacheKey(id), todo.toJSON());
	}

	async query(filter: ITodoQuery): Promise<IPaginatedResponse<ITodo>> {
		try {
			const {
				page = 1,
				limit = 10,
				sortBy = "createdAt",
				sortOrder = "desc",
				dueDate,
				tags,
				...queryFilters
			} = filter;

			const query: any = {
				...queryFilters,
				isDeleted: false,
			};

			// Handle date range queries
			if (dueDate?.start || dueDate?.end) {
				query.dueDate = {};
				if (dueDate.start) {
					query.dueDate.$gte = dueDate.start;
				}
				if (dueDate.end) {
					query.dueDate.$lte = dueDate.end;
				}
			}

			// Handle tag queries
			if (tags && tags.length > 0) {
				query.tags = { $all: tags };
			}

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as {
				[key: string]: SortOrder;
			};

			const [items, total] = await Promise.all([
				TodoModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
				TodoModel.countDocuments(query),
			]);

			return {
				items,
				metadata: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			logger.error("Failed to query todos:", error);
			throw new AppError(
				ErrorCodes.DATABASE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to query todos",
			);
		}
	}

	async bulkUpdate(
		ids: string[],
		update: Partial<ITodo>,
		_session?: ClientSession,
	): Promise<number> {
		try {
			const result = await TodoModel.updateMany(
				{ _id: { $in: ids }, isDeleted: false },
				update,
			);

			// Invalidate cache for all updated todos
			await Promise.all(
				ids.map(id => this.cacheDelete(this.getCacheKey(id))),
			);

			// Publish bulk update event
			await this.publishEvent("TODOS_BULK_UPDATED", {
				ids,
				update,
				modifiedCount: result.modifiedCount,
			});

			return result.modifiedCount;
		} catch (error) {
			logger.error("Failed to bulk update todos:", error);
			throw new AppError(
				ErrorCodes.DATABASE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to bulk update todos",
			);
		}
	}

	async getStatistics(): Promise<any> {
		try {
			const stats = await TodoModel.aggregate([
				{
					$match: { isDeleted: false },
				},
				{
					$group: {
						_id: null,
						totalTodos: { $sum: 1 },
						completedTodos: {
							$sum: {
								$cond: [
									{ $eq: ["$status", TodoStatus.COMPLETED] },
									1,
									0,
								],
							},
						},
						pendingTodos: {
							$sum: {
								$cond: [
									{ $eq: ["$status", TodoStatus.PENDING] },
									1,
									0,
								],
							},
						},
						inProgressTodos: {
							$sum: {
								$cond: [
									{
										$eq: [
											"$status",
											TodoStatus.IN_PROGRESS,
										],
									},
									1,
									0,
								],
							},
						},
						highPriorityTodos: {
							$sum: {
								$cond: [
									{ $in: ["$priority", ["HIGH", "URGENT"]] },
									1,
									0,
								],
							},
						},
						overdueTodos: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $lt: ["$dueDate", new Date()] },
											{
												$ne: [
													"$status",
													TodoStatus.COMPLETED,
												],
											},
										],
									},
									1,
									0,
								],
							},
						},
					},
				},
			]);

			return (
				stats[0] || {
					totalTodos: 0,
					completedTodos: 0,
					pendingTodos: 0,
					inProgressTodos: 0,
					highPriorityTodos: 0,
					overdueTodos: 0,
				}
			);
		} catch (error) {
			logger.error("Failed to get todo statistics:", error);
			throw new AppError(
				ErrorCodes.DATABASE_ERROR,
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get todo statistics",
			);
		}
	}
}
