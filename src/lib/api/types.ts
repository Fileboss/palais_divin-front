export interface CoordinatesDto {
	latitude: number;
	longitude: number;
}

export interface CreateRestaurantRequest {
	name: string;
	address: string;
}

export interface RestaurantResponse {
	id: string;
	name: string;
	address?: string;
	location?: CoordinatesDto;
	avgRating?: number;
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

export interface InvitationResponse {
	id: string;
	expiresAt: string;
	signupUrl: string;
}

export interface SignupRequest {
	token: string;
	email: string;
	displayName: string;
	password: string;
}

export interface SignupResponse {
	id: string;
	email: string;
	displayName: string;
	createdAt: string;
}

export interface ReviewResponse {
	id: string;
	restaurantId: string;
	authorId: string;
	rating: number;
	comment?: string;
	createdAt: string;
}

export interface ReviewsPageResponse {
	data: ReviewResponse[];
	page: PageMeta;
}

export interface CreateReviewRequest {
	rating: number;
	comment?: string;
}

export interface RecommendationResponse {
	id: string;
	name: string;
	address?: string;
	latitude?: number;
	longitude?: number;
	affinity: number;
	recommenderCount: number;
}

export interface RecommendationsPageResponse {
	data: RecommendationResponse[];
	page: PageMeta;
}

export interface RestaurantAffinityResponse {
	restaurantId: string;
	affinity: number;
	recommenderCount: number;
}

export interface ConnectionResponse {
	id: string;
	sourceUserId: string;
	targetUserId: string;
	createdAt: string;
}

export interface ProblemFieldError {
	field: string;
	message: string;
}

export interface ProblemDetails {
	type: string;
	title: string;
	status: number;
	detail?: string;
	errors?: ProblemFieldError[];
	reason?: string;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly problem?: ProblemDetails
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export async function parseProblem(res: Response): Promise<ProblemDetails | null> {
	const ct = res.headers.get('content-type') ?? '';
	if (!ct.includes('application/problem+json') && !ct.includes('application/json')) return null;
	try {
		return (await res.json()) as ProblemDetails;
	} catch {
		return null;
	}
}
