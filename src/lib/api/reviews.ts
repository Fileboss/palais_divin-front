import {
	ApiError,
	type CreateReviewRequest,
	type MyReviewsBatchResponse,
	type ReviewResponse,
	type ReviewsPageResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

export async function createReview(
	fetcher: Fetcher,
	restaurantId: string,
	body: CreateReviewRequest,
	idempotencyKey: string
): Promise<ReviewResponse> {
	const res = await fetcher(
		`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/reviews`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'Idempotency-Key': idempotencyKey
			},
			body: JSON.stringify(body)
		}
	);
	return parseOrThrow<ReviewResponse>(res);
}

export async function updateReview(
	fetcher: Fetcher,
	restaurantId: string,
	body: CreateReviewRequest
): Promise<ReviewResponse> {
	const res = await fetcher(
		`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/reviews`,
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(body)
		}
	);
	return parseOrThrow<ReviewResponse>(res);
}

export async function getMyReview(
	fetcher: Fetcher,
	restaurantId: string
): Promise<ReviewResponse | null> {
	const res = await fetcher(
		`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/reviews`,
		{ headers: { Accept: 'application/json' } }
	);
	if (res.status === 404) return null;
	return parseOrThrow<ReviewResponse>(res);
}

export async function listMyReviewsBatch(
	fetcher: Fetcher,
	restaurantIds: string[]
): Promise<Record<string, ReviewResponse | null>> {
	const result: Record<string, ReviewResponse | null> = {};
	if (restaurantIds.length === 0) return result;
	const qs = new URLSearchParams();
	for (const id of restaurantIds) qs.append('restaurantIds', id);
	const res = await fetcher(`/api/v1/user/reviews?${qs}`, {
		headers: { Accept: 'application/json' }
	});
	const body = await parseOrThrow<MyReviewsBatchResponse>(res);
	for (const id of restaurantIds) result[id] = body.reviews[id] ?? null;
	return result;
}

export async function listReviewsPublic(
	fetcher: Fetcher,
	restaurantId: string,
	options: { cursor?: string; size?: number } = {}
): Promise<ReviewsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const base = `/api/v1/public/restaurants/${encodeURIComponent(restaurantId)}/reviews`;
	const url = qs.size > 0 ? `${base}?${qs}` : base;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<ReviewsPageResponse>(res);
}
