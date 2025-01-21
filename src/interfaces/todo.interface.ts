export enum TodoStatus {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED",
	ARCHIVED = "ARCHIVED",
}

export enum TodoPriority {
	LOW = "LOW",
	MEDIUM = "MEDIUM",
	HIGH = "HIGH",
	URGENT = "URGENT",
}

export interface ITodo {
	_id?: string;
	title: string;
	description?: string;
	status: TodoStatus;
	priority: TodoPriority;
	dueDate?: Date;
	tags?: string[];
	assignedTo?: string;
	createdBy: string;
	createdAt?: Date;
	updatedAt?: Date;
	completedAt?: Date;
	isDeleted?: boolean;
	version?: number;
}

export interface ITodoCreate
	extends Omit<ITodo, "_id" | "createdAt" | "updatedAt" | "version"> {}

export interface ITodoUpdate
	extends Partial<
		Omit<ITodo, "_id" | "createdAt" | "updatedAt" | "version">
	> {
	version: number; // Required for optimistic concurrency control
}

export interface ITodoQuery {
	status?: TodoStatus;
	priority?: TodoPriority;
	assignedTo?: string;
	createdBy?: string;
	tags?: string[];
	dueDate?: {
		start?: Date;
		end?: Date;
	};
	isDeleted?: boolean;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
