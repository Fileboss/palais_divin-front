import {
	ApiError,
	type CreateRestaurantRequest,
	type RestaurantResponse,
	type RestaurantsPageResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

function buildUrl(path: string, baseUrl: string, query?: URLSearchParams): string {
	const qs = query && [...query].length > 0 ? `?${query}` : '';
	return `${baseUrl}${path}${qs}`;
}

export async function listRestaurants(
	fetcher: Fetcher,
	options: { cursor?: string; size?: number; baseUrl?: string } = {}
): Promise<RestaurantsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const url = buildUrl('/api/v1/public/restaurants', options.baseUrl ?? '', qs);
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<RestaurantsPageResponse>(res);
}

export async function createRestaurant(
	fetcher: Fetcher,
	body: CreateRestaurantRequest,
	options: { baseUrl?: string } = {}
): Promise<RestaurantResponse> {
	const url = buildUrl('/api/v1/public/restaurants', options.baseUrl ?? '');
	const res = await fetcher(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	return parseOrThrow<RestaurantResponse>(res);
}
