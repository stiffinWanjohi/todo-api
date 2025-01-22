import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logFormat = winston.format.combine(
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json(),
);

const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || "info",
	format: logFormat,
	defaultMeta: { service: "todo-api" },
	transports: [
		// Error logs
		new DailyRotateFile({
			filename: "logs/error-%DATE%.log",
			datePattern: "YYYY-MM-DD",
			zippedArchive: true,
			maxSize: "20m",
			maxFiles: "14d",
			level: "error",
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(
					({ timestamp, level, message, stack }) => {
						return `[${timestamp}] ${level}: ${message} ${stack || ""}`;
					},
				),
			),
		}),

		// Combined logs (info, warn, error)
		new DailyRotateFile({
			filename: "logs/combined-%DATE%.log",
			datePattern: "YYYY-MM-DD",
			zippedArchive: true,
			maxSize: "20m",
			maxFiles: "14d",
			format: logFormat,
		}),
	],
});

if (process.env.NODE_ENV !== "production") {
	logger.add(
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple(),
			),
		}),
	);
} else {
	// Example: Sending logs to an external service in production (e.g., Sentry, Loggly, etc.)
	// logger.add(new SomeExternalTransport({ ... }));
}

if (process.env.NODE_ENV === "test") {
	logger.transports.forEach(transport => {
		transport.silent = true;
	});
}

export { logger };
