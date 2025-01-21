import { Response, NextFunction } from "express";
import { CustomRequest } from "@/types/custom-types";
import { TodoService } from "@/services/todo.service";
import {
	ITodoCreate,
	ITodoUpdate,
	ITodoQuery,
	TodoStatus,
	TodoPriority,
	ITodo,
} from "@/interfaces/todo.interface";
import { ResponseHandler, wrapAsync } from "@/utils/response-handler";
import { logger } from "@/utils/logger";
import { AppError, ErrorCodes, HttpStatus } from "@/utils/error-codes";
import { CacheMiddleware } from "@/middleware/cache.middleware";

export class TodoController {
	private todoService: TodoService;

	constructor() {
		this.todoService = new TodoService();
	}

	private validateDates(startDate?: string, endDate?: string): void {
		if (startDate && !Date.parse(startDate)) {
			throw new AppError(
				ErrorCodes.VALIDATION_ERROR,
				HttpStatus.BAD_REQUEST,
				"Invalid start date format",
			);
		}
		if (endDate && !Date.parse(endDate)) {
			throw new AppError(
				ErrorCodes.VALIDATION_ERROR,
				HttpStatus.BAD_REQUEST,
				"Invalid end date format",
			);
		}
		if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
			throw new AppError(
				ErrorCodes.VALIDATION_ERROR,
				HttpStatus.BAD_REQUEST,
				"Start date cannot be after end date",
			);
		}
	}

	private validatePagination(page?: string, limit?: string): void {
		const pageNum = page ? parseInt(page, 10) : undefined;
		const limitNum = limit ? parseInt(limit, 10) : undefined;

		if (pageNum !== undefined && (isNaN(pageNum) || pageNum < 1)) {
			throw new AppError(
				ErrorCodes.VALIDATION_ERROR,
				HttpStatus.BAD_REQUEST,
				"Invalid page number",
			);
		}

		if (
			limitNum !== undefined &&
			(isNaN(limitNum) || limitNum < 1 || limitNum > 100)
		) {
			throw new AppError(
				ErrorCodes.VALIDATION_ERROR,
				HttpStatus.BAD_REQUEST,
				"Invalid limit value. Must be between 1 and 100",
			);
		}
	}

	queryTodos = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const {
				page,
				limit,
				startDate,
				endDate,
				status,
				priority,
				sortBy,
				sortOrder,
				...restQuery
			} = req.query as Record<string, string>;

			this.validatePagination(page, limit);
			this.validateDates(startDate, endDate);

			const query: ITodoQuery = {
				...restQuery,
				page: page ? parseInt(page, 10) : undefined,
				limit: limit ? parseInt(limit, 10) : undefined,
				status: status as TodoStatus,
				priority: priority as TodoPriority,
				sortBy: sortBy as string,
				sortOrder: sortOrder as "asc" | "desc",
				dueDate:
					startDate || endDate
						? {
								start: startDate
									? new Date(startDate)
									: undefined,
								end: endDate ? new Date(endDate) : undefined,
							}
						: undefined,
			};

			const result = await this.todoService.query(query);

			res.set({
				"X-Total-Count": result.metadata.total?.toString() || "0",
				"X-Total-Pages": result.metadata.totalPages?.toString() || "0",
				"X-Current-Page": result.metadata.page?.toString() || "1",
				"X-Page-Size": result.metadata.limit?.toString() || "10",
			});

			ResponseHandler.success(res, result.items, result.metadata);
		},
	);

	getTodoById = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const { id } = req.params;
			const todo = await this.todoService.findById(id);
			ResponseHandler.success(res, todo);
		},
	);

	createTodo = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const todoData: ITodoCreate = {
				...req.body,
				createdBy: req.user?.id,
			};

			const session = await req.db.startSession();
			let todo: ITodo | undefined;

			try {
				await session.withTransaction(async () => {
					todo = await this.todoService.create(todoData, session);
				});

				if (!todo) {
					throw new AppError(
						ErrorCodes.INTERNAL_SERVER_ERROR,
						HttpStatus.INTERNAL_SERVER_ERROR,
						"Failed to create todo",
					);
				}

				// Invalidate cache after creating new to-do
				await CacheMiddleware.invalidateCache(["todos"]);

				logger.info("Todo created successfully", { todoId: todo._id });
				ResponseHandler.created(res, todo);
			} finally {
				await session.endSession();
			}
		},
	);

	updateTodo = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const { id } = req.params;
			const updateData: ITodoUpdate = req.body;

			const session = await req.db.startSession();
			try {
				await session.withTransaction(async () => {
					const updatedTodo = await this.todoService.update(
						id,
						updateData,
						session,
					);

					// Invalidate both specific to-do and list caches
					await CacheMiddleware.invalidateCache(["todos", "todo"]);

					ResponseHandler.success(res, updatedTodo);
				});
			} finally {
				await session.endSession();
			}
		},
	);

	deleteTodo = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const { id } = req.params;
			const session = await req.db.startSession();

			try {
				await session.withTransaction(async () => {
					await this.todoService.delete(id, session);

					// Invalidate both specific todo and list caches
					await CacheMiddleware.invalidateCache(["todos", "todo"]);

					ResponseHandler.noContent(res);
				});
			} finally {
				await session.endSession();
			}
		},
	);

	bulkUpdateTodos = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const { ids, update } = req.body;

			const session = await req.db.startSession();
			try {
				await session.withTransaction(async () => {
					const updatedCount = await this.todoService.bulkUpdate(
						ids,
						update,
						session,
					);

					// Invalidate both specific todo and list caches
					await CacheMiddleware.invalidateCache(["todos", "todo"]);

					ResponseHandler.success(res, { updatedCount });
				});
			} finally {
				await session.endSession();
			}
		},
	);

	restoreTodo = wrapAsync(
		async (
			req: CustomRequest,
			res: Response,
			_next: NextFunction,
		): Promise<void> => {
			const { id } = req.params;
			const session = await req.db.startSession();

			try {
				await session.withTransaction(async () => {
					await this.todoService.restore(id, session);

					// Invalidate both specific todo and list caches
					await CacheMiddleware.invalidateCache(["todos", "todo"]);

					ResponseHandler.success(res, {
						message: "Todo restored successfully",
					});
				});
			} finally {
				await session.endSession();
			}
		},
	);
}
