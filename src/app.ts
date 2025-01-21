import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { connectDB } from "@/config/database";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware";
import { createRoutes } from "@/routes";
import { logger } from "@/utils/logger";

export class App {
	private readonly app: Application;

	constructor() {
		this.app = express();
		this.setupMiddlewares();
		this.setupRoutes();
		this.setupErrorHandling();
	}

	private setupMiddlewares(): void {
		// Security middlewares
		this.app.use(helmet());
		this.app.use(cors());

		// Body parsing
		this.app.use(express.json());
		this.app.use(express.urlencoded({ extended: true }));

		// Compression
		this.app.use(compression());

		// Request logging
		this.app.use((req, _res, next) => {
			logger.info(`${req.method} ${req.url}`, {
				query: req.query,
				body: req.body,
			});
			next();
		});
	}

	private setupRoutes(): void {
		// Mount all routes
		this.app.use(createRoutes());
	}

	private setupErrorHandling(): void {
		// Handle 404
		this.app.use(notFoundHandler);

		// Handle all errors
		this.app.use(errorHandler);
	}

	public async start(port: number = 3000): Promise<void> {
		try {
			// Connect to MongoDB using the connectDatabase function
			await connectDB();

			// Start server
			this.app.listen(port, () => {
				logger.info(`Server is running on port ${port}`);
			});
		} catch (error) {
			logger.error("Failed to start server:", error);
			process.exit(1);
		}
	}

	public getApp(): Application {
		return this.app;
	}
}

// Create and export default instance
const app = new App();
export default app;
