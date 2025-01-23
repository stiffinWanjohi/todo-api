import express, { Router } from "express";
import { TodoController } from "../controllers/todo.controller";
import { CacheMiddleware } from "../middleware/cache.middleware";
import { validate } from "../middleware/validation.middleware";

export const createTodoRouter = (todoController: TodoController): Router => {
	const router = express.Router();

	// GET route for statistics
	router.get(
		"/statistics",
		CacheMiddleware.cache({
			key: "todoStatistics",
			ttl: 300,
			tags: ["todoStatistics"],
		}),
		todoController.getStatistics,
	);

	// GET routes with caching
	router.get(
		"/",
		CacheMiddleware.cache({
			key: "todos",
			ttl: 300, // 5 minutes
			tags: ["todos"],
		}),
		todoController.queryTodos,
	);

	router.get(
		"/:id",
		CacheMiddleware.cache({
			key: "todo",
			ttl: 300,
			tags: ["todo"],
		}),
		todoController.getTodoById,
	);

	// POST routes
	router.post("/", validate("create"), todoController.createTodo);

	// PUT routes
	router.put("/:id", validate("update"), todoController.updateTodo);

	// DELETE route
	router.delete("/:id", todoController.deleteTodo);

	// Bulk update route
	router.post(
		"/bulk-update",
		validate("bulkUpdate"),
		todoController.bulkUpdateTodos,
	);

	// Restore route
	router.post("/:id/restore", todoController.restoreTodo);

	return router;
};
