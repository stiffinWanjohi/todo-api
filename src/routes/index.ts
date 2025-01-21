import express, { Router } from "express";
import { TodoController } from "@/controllers/todo.controller";
import { createTodoRouter } from "./todo.routes";
import { createHealthRouter } from "./health.routes";

export const createRoutes = (): Router => {
	const router = express.Router();
	const todoController = new TodoController();

	// Mount health routes
	router.use("/health", createHealthRouter());

	// Mount to-do routes
	router.use("/api/v1/todos", createTodoRouter(todoController));

	return router;
};