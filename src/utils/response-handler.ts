import { Response } from "express";
import { HttpStatus } from "./error-codes";
import { IApiResponse } from "../interfaces/response.interface";

export class ResponseHandler {
	static success<T>(
		res: Response,
		data?: T,
		metadata?: IApiResponse<T>["metadata"],
		status: HttpStatus = HttpStatus.OK,
	): Response {
		const response: IApiResponse<T> = {
			success: true,
			data,
			metadata,
			timestamp: Date.now(),
		};
		return res.status(status).json(response);
	}

	static error(
		res: Response,
		code: string,
		message: string,
		status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
		details?: Record<string, unknown>,
	): Response {
		const response: IApiResponse<null> = {
			success: false,
			error: {
				code,
				message,
				details,
			},
			timestamp: Date.now(),
		};
		return res.status(status).json(response);
	}

	static created<T>(
		res: Response,
		data: T,
		metadata?: IApiResponse<T>["metadata"],
	): Response {
		return this.success(res, data, metadata, HttpStatus.CREATED);
	}

	static noContent(res: Response): Response {
		return res.status(HttpStatus.NO_CONTENT).send();
	}

	static paginated<T>(
		res: Response,
		data: T[],
		page: number,
		limit: number,
		total: number,
	): Response {
		return this.success(res, data, { page, limit, total });
	}
}

export const wrapAsync = (fn: Function) => {
	return function (req: any, res: any, next: any) {
		fn(req, res, next).catch(next);
	};
};
