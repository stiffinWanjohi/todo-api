import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { Errors } from "@/utils/error-codes";
import { TodoStatus, TodoPriority } from "@/interfaces/todo.interface";

const todoSchema = {
	create: Joi.object({
		title: Joi.string().required().min(1).max(255),
		description: Joi.string().max(1000).optional(),
		status: Joi.string().valid(...Object.values(TodoStatus)),
		priority: Joi.string().valid(...Object.values(TodoPriority)),
		dueDate: Joi.date().iso().optional(),
		tags: Joi.array().items(Joi.string()).optional(),
		assignedTo: Joi.string().optional(),
	}),

	update: Joi.object({
		title: Joi.string().min(1).max(255).optional(),
		description: Joi.string().max(1000).optional(),
		status: Joi.string()
			.valid(...Object.values(TodoStatus))
			.optional(),
		priority: Joi.string()
			.valid(...Object.values(TodoPriority))
			.optional(),
		dueDate: Joi.date().iso().optional(),
		tags: Joi.array().items(Joi.string()).optional(),
		assignedTo: Joi.string().optional(),
		version: Joi.number().required(),
	}),

	query: Joi.object({
		status: Joi.string()
			.valid(...Object.values(TodoStatus))
			.optional(),
		priority: Joi.string()
			.valid(...Object.values(TodoPriority))
			.optional(),
		assignedTo: Joi.string().optional(),
		createdBy: Joi.string().optional(),
		tags: Joi.array().items(Joi.string()).optional(),
		startDate: Joi.date().iso().optional(),
		endDate: Joi.date().iso().optional(),
		page: Joi.number().min(1).optional(),
		limit: Joi.number().min(1).max(100).optional(),
		sortBy: Joi.string()
			.valid("createdAt", "dueDate", "priority")
			.optional(),
		sortOrder: Joi.string().valid("asc", "desc").optional(),
	}),

	bulkUpdate: Joi.object({
		ids: Joi.array().items(Joi.string()).min(1).required(),
		update: Joi.object({
			status: Joi.string()
				.valid(...Object.values(TodoStatus))
				.optional(),
			priority: Joi.string()
				.valid(...Object.values(TodoPriority))
				.optional(),
			assignedTo: Joi.string().optional(),
			tags: Joi.array().items(Joi.string()).optional(),
		}).required(),
	}),
};

export const validate = (schema: keyof typeof todoSchema) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		const { error } = todoSchema[schema].validate(req.body, {
			abortEarly: false,
			stripUnknown: true,
		});

		if (error) {
			// Map the error details to a structured format
			const details = error.details.map(detail => ({
				field: detail.path.join("."),
				message: detail.message,
			}));

			// Use the predefined AppError structure
			next(Errors.validation({ validationErrors: details }));
			return;
		}

		next();
	};
};
