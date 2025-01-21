import "dotenv/config";
import app from "./app";
import { logger } from "@/utils/logger";

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
	logger.error("Uncaught Exception:", error);
	process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
	logger.error("Unhandled Rejection at:", promise, "reason:", reason);
	process.exit(1);
});

// Handle termination signals
process.on("SIGTERM", () => {
	logger.info("SIGTERM signal received. Closing HTTP server...");
	process.exit(0);
});

process.on("SIGINT", () => {
	logger.info("SIGINT signal received. Closing HTTP server...");
	process.exit(0);
});

// Get port from environment variable or use default
const PORT = parseInt(process.env.PORT || "3000", 10);

// Start the application
app.start(PORT).catch(error => {
	logger.error("Failed to start application:", error);
	process.exit(1);
});
