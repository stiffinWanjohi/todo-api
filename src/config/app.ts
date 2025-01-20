import { CorsOptions } from "cors";
import { json, urlencoded } from "express";
import helmet from "helmet";
import compression from "compression";

export interface AppConfig {
	port: number;
	env: string;
	api: {
		prefix: string;
		version: string;
	};
	cors: CorsOptions;
	rateLimit: {
		windowMs: number;
		max: number;
	};
}

export const appConfig: AppConfig = {
	port: parseInt(process.env.PORT || "3000", 10),
	env: process.env.NODE_ENV || "development",
	api: {
		prefix: "/api",
		version: "/v1",
	},
	cors: {
		origin: process.env.CORS_ORIGIN || "*",
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["X-Total-Count"],
		credentials: true,
		maxAge: 86400,
	},
	rateLimit: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // limit each IP to 100 requests per windowMs
	},
};

export const middleware = {
	json: json({ limit: "10mb" }),
	urlencoded: urlencoded({ extended: true, limit: "10mb" }),
	helmet: helmet(),
	compression: compression({
		filter: (req, res) => {
			if (req.headers["x-no-compression"]) {
				return false;
			}
			return compression.filter(req, res);
		},
		level: 6, // Default compression level
	}),
};
