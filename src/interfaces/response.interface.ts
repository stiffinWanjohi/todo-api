export interface IMetadata {
	page?: number;
	limit?: number;
	total?: number;
	totalPages?: number;
}

export interface IApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
	metadata?: IMetadata;
	timestamp: number;
	path?: string;
}

export interface IPaginatedResponse<T> {
	items: T[];
	metadata: IMetadata;
}

export interface ICacheConfig {
	key: string;
	ttl: number;
	tags?: string[];
}
