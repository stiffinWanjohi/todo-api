import { Request, Response, NextFunction } from "express";
import { AppError, Errors, HttpStatus } from "../utils/error-codes";
import { logger } from "../utils/logger";
import { ResponseHandler } from "../utils/response-handler";

export const errorHandler = (
	error: Error,
	req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	// Log the error for debugging purposes
	logger.error("Error occurred:", {
		message: error.message,
		stack: error.stack,
		path: req.path,
		method: req.method,
	});

	// Handle AppError (custom application errors)
	if (error instanceof AppError) {
		ResponseHandler.error(
			res,
			error.code,
			error.message,
			error.status,
			error.details,
		);
		return;
	}

	// Handle validation errors (e.g., from libraries like Joi)
	if (error.name === "ValidationError") {
		ResponseHandler.error(
			res,
			Errors.validation({ message: error.message, stack: error.stack })
				.code,
			"Validation failed",
			HttpStatus.BAD_REQUEST,
			{ details: (error as any).details || error.stack },
		);
		return;
	}

	// Handle MongoDB errors
	if (error.name === "MongoError" || error.name === "MongoServerError") {
		if ((error as any).code === 11000) {
			ResponseHandler.error(
				res,
				Errors.duplicate("Resource").code,
				"Duplicate key error",
				HttpStatus.CONFLICT,
				{ details: error.message },
			);
			return;
		}
		ResponseHandler.error(
			res,
			Errors.internal("Database error").code,
			"Database error",
			HttpStatus.INTERNAL_SERVER_ERROR,
			{ details: error.message },
		);
		return;
	}

	// Default to Internal Server Error for unhandled exceptions
	ResponseHandler.error(
		res,
		Errors.internal().code,
		"Internal server error",
		HttpStatus.INTERNAL_SERVER_ERROR,
		{ details: error.message },
	);
};

export const notFoundHandler = (
	req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	ResponseHandler.error(
		res,
		Errors.notFound(req.path).code,
		`Route ${req.path} not found`,
		HttpStatus.NOT_FOUND,
	);
};
