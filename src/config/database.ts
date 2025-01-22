import mongoose from "mongoose";
import { logger } from "../utils/logger";

const MONGODB_URI =
	process.env.MONGODB_URI ||
	"mongodb://localhost:27017/todo_app?replicaSet=rs0&readPreference=primary";

export const connectDB = async (): Promise<typeof mongoose> => {
	try {
		mongoose.set("strictQuery", true);

		// Connect to MongoDB
		const connection = await mongoose.connect(MONGODB_URI, {
			minPoolSize: 10,
			maxPoolSize: 100,
			socketTimeoutMS: 60000,
			connectTimeoutMS: 60000,
			serverSelectionTimeoutMS: 30000,
			heartbeatFrequencyMS: 10000,
			retryWrites: true,
		});

		logger.info("MongoDB connected successfully");

		// Handle connection events
		mongoose.connection.on("error", error => {
			logger.error("MongoDB connection error:", error);
		});

		mongoose.connection.on("disconnected", () => {
			logger.warn("MongoDB disconnected. Attempting to reconnect...");
		});

		mongoose.connection.on("reconnected", () => {
			logger.info("MongoDB reconnected");
		});

		// Handle process termination
		process.on("SIGINT", async () => {
			try {
				await mongoose.connection.close();
				logger.info(
					"MongoDB connection closed through app termination",
				);
				process.exit(0);
			} catch (error) {
				logger.error("Error closing MongoDB connection:", error);
				process.exit(1);
			}
		});

		return connection;
	} catch (error) {
		logger.error("Error connecting to MongoDB:", error);
		throw error;
	}
};

export const closeDB = async (): Promise<void> => {
	try {
		await mongoose.connection.close();
		logger.info("MongoDB connection closed");
	} catch (error) {
		logger.error("Error closing MongoDB connection:", error);
		throw error;
	}
};

export const checkConnection = (): boolean => {
	return mongoose.connection.readyState === 1;
};
