export interface CoordinatesDto {
	latitude: number;
	longitude: number;
}

export interface CreateRestaurantRequest {
	name: string;
	address: string;
}

export type TagCategory = 'REGIME' | 'TYPE' | 'SPECIALTY' | 'VENUE_TYPE' | 'SERVICE_AND_PLACE';

export const TAG_CATEGORIES: TagCategory[] = [
	'REGIME',
	'TYPE',
	'SPECIALTY',
	'VENUE_TYPE',
	'SERVICE_AND_PLACE'
];

export interface TagSummary {
	slug: string;
	label: string;
	labelI18n?: Record<string, string>;
	category: TagCategory;
}

export interface TagResponse {
	id: string;
	slug: string;
	label: string;
	labelI18n?: Record<string, string>;
	category: TagCategory;
	createdAt: string;
}

export interface CreateTagRequest {
	category: TagCategory;
	label: string;
	labelI18n?: Record<string, string>;
	slug: string;
}

export interface CategoryGroup {
	category: TagCategory;
	tags: TagResponse[];
}

export interface TagCatalogResponse {
	groups: CategoryGroup[];
}

export interface RestaurantTagResponse {
	tagId: string;
	restaurantId: string;
	attachedBy: string;
	attachedAt: string;
}

export interface TagImplicationResponse {
	tagId: string;
	impliesTagId: string;
	createdAt: string;
}

export interface CreateTagImplicationRequest {
	tagId: string;
	impliesTagId: string;
}

export interface TagImplicationsResponse {
	data: TagImplicationResponse[];
}

export interface RestaurantResponse {
	id: string;
	name: string;
	address?: string;
	location?: CoordinatesDto;
	avgRating?: number;
	distanceMetres?: number | null;
	thumbnail?: PhotoSummary | null;
	affinity?: number | null;
	tags?: TagSummary[];
	dineIn?: boolean;
	takeOut?: boolean;
	delivery?: boolean;
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
	authorDisplayName?: string;
	rating: number;
	comment?: string;
	createdAt: string;
}

export interface ReviewsPageResponse {
	data: ReviewResponse[];
	page: PageMeta;
}

export interface MyReviewsBatchResponse {
	reviews: Record<string, ReviewResponse>;
}

export interface GeocodeMatch {
	label: string;
	latitude: number;
	longitude: number;
}

export interface CreateReviewRequest {
	rating: number;
	comment?: string;
}

export interface RecommendationResponse {
	id: string;
	name: string;
	address?: string;
	location?: CoordinatesDto;
	affinity: number;
	recommenderCount: number;
	avgRating?: number | null;
	distanceMetres?: number | null;
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

export interface PhotoResponse {
	id: string;
	restaurantId: string;
	authorId: string;
	contentType: string;
	objectKey: string;
	createdAt: string;
}

export interface PhotoSummary {
	id: string;
	url: string;
	expiresAt: string;
}

export interface PhotosPageResponse {
	data: PhotoSummary[];
	page: PageMeta;
}

export interface PhotoUploadUrlResponse {
	uploadUrl: string;
	objectKey: string;
	expiresAt: string;
}

export interface PhotoDownloadUrlResponse {
	downloadUrl: string;
	objectKey: string;
	expiresAt: string;
}

export interface RegisterPhotoRequest {
	contentType: string;
	objectKey: string;
}

export interface PublicUserResponse {
	id: string;
	displayName: string;
	createdAt: string;
	isFollowedByMe: boolean | null;
}

export interface AuthorReviewRestaurantRef {
	id: string;
	name: string;
	address: string;
}

export interface AuthorReviewResponse {
	reviewId: string;
	rating: number;
	comment?: string;
	createdAt: string;
	restaurant: AuthorReviewRestaurantRef;
}

export interface AuthorReviewsPageResponse {
	data: AuthorReviewResponse[];
	page: PageMeta;
}

export interface ConnectionResponse {
	id: string;
	sourceUserId: string;
	targetUserId: string;
	createdAt: string;
}

export interface FollowingResponse {
	user: PublicUserResponse;
	createdAt: string;
}

export interface FollowingPageResponse {
	data: FollowingResponse[];
	page: PageMeta;
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

export function fieldErrorsFrom(err: unknown): Record<string, string> {
	if (!(err instanceof ApiError)) return {};
	const fields: Record<string, string> = {};
	for (const fe of err.problem?.errors ?? []) {
		if (fe.field) fields[fe.field] = fe.message;
	}
	return fields;
}
