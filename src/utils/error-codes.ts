export enum HttpStatus {
	OK = 200,
	CREATED = 201,
	NO_CONTENT = 204,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	CONFLICT = 409,
	UNPROCESSABLE_ENTITY = 422,
	TOO_MANY_REQUESTS = 429,
	INTERNAL_SERVER_ERROR = 500,
	SERVICE_UNAVAILABLE = 503,
}

export const ErrorCodes = {
	VALIDATION_ERROR: "VALIDATION_ERROR",
	RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
	DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	DATABASE_ERROR: "DATABASE_ERROR",
	CACHE_ERROR: "CACHE_ERROR",
	KAFKA_ERROR: "KAFKA_ERROR",
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
	TODO_NOT_FOUND: "TODO_NOT_FOUND",
	TODO_VERSION_CONFLICT: "TODO_VERSION_CONFLICT",
	INVALID_VERSION: "INVALID_VERSION",
	INVALID_REQUEST: "INVALID_REQUEST",
	CACHE_MISS: "CACHE_MISS",
	EVENT_PUBLISH_ERROR: "EVENT_PUBLISH_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError extends Error {
	code: ErrorCode;
	status: HttpStatus;
	details?: Record<string, unknown>;
}

export class AppError extends Error implements ApiError {
	constructor(
		public code: ErrorCode,
		public status: HttpStatus,
		message: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "ApplicationError";
	}
}

// Predefined error instances for common scenarios
export const Errors = {
	notFound: (resource: string) =>
		new AppError(
			ErrorCodes.RESOURCE_NOT_FOUND,
			HttpStatus.NOT_FOUND,
			`${resource} not found`,
		),

	validation: (details: Record<string, unknown>) =>
		new AppError(
			ErrorCodes.VALIDATION_ERROR,
			HttpStatus.BAD_REQUEST,
			"Validation error",
			details,
		),

	duplicate: (resource: string) =>
		new AppError(
			ErrorCodes.DUPLICATE_RESOURCE,
			HttpStatus.CONFLICT,
			`${resource} already exists`,
		),

	internal: (message = "Internal server error") =>
		new AppError(
			ErrorCodes.INTERNAL_SERVER_ERROR,
			HttpStatus.INTERNAL_SERVER_ERROR,
			message,
		),
};
