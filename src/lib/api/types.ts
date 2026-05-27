export interface CoordinatesDto {
	latitude: number;
	longitude: number;
}

export interface CreateRestaurantRequest {
	name: string;
	address?: string;
	location: CoordinatesDto;
}

export interface RestaurantResponse {
	id: string;
	name: string;
	address?: string;
	location: CoordinatesDto;
	createdAt: string;
}

export interface PageMeta {
	hasNext: boolean;
	nextCursor?: string;
	size: number;
}

export interface RestaurantsPageResponse {
	data: RestaurantResponse[];
	page: PageMeta;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}
