import { Request } from "express";
import { ClientSession } from "mongodb";

export interface User {
	id: string;
}

export interface CustomDB {
	startSession(): Promise<ClientSession>;
}

export interface CustomRequest extends Request {
	user?: User;
	db: CustomDB;
}
