import express, { Router } from "express";

export const createHealthRouter = (): Router => {
	const router = express.Router();

	router.get("/", (_req, res) => {
		res.json({
			status: "ok",
			timestamp: new Date().toISOString(),
		});
	});

	return router;
};
