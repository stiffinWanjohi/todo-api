import mongoose from "mongoose";
import { logger } from "@/utils/logger";

export interface DatabaseConfig {
	uri: string;
	options: mongoose.ConnectOptions;
}

const defaultOptions: mongoose.ConnectOptions = {
	maxPoolSize: 100,
	minPoolSize: 10,
	socketTimeoutMS: 45000,
	serverSelectionTimeoutMS: 5000,
	heartbeatFrequencyMS: 10000,
	retryWrites: true,
	w: "majority",
	readPreference: "secondaryPreferred",
};

export const dbConfig: DatabaseConfig = {
	uri: process.env.MONGODB_URI || "mongodb://localhost:27017/todo_app",
	options: {
		...defaultOptions,
		replicaSet: process.env.MONGODB_REPLICASET || "rs0",
	},
};

export const connectDatabase = async (): Promise<void> => {
	try {
		await mongoose.connect(dbConfig.uri, dbConfig.options);
		logger.info("Successfully connected to MongoDB");

		mongoose.connection.on("error", error => {
			logger.error("MongoDB connection error:", error);
		});

		mongoose.connection.on("disconnected", () => {
			logger.warn("MongoDB disconnected. Attempting to reconnect...");
		});

		mongoose.connection.on("reconnected", () => {
			logger.info("MongoDB reconnected");
		});
	} catch (error) {
		logger.error("Error connecting to MongoDB:", error);
		process.exit(1);
	}
};
