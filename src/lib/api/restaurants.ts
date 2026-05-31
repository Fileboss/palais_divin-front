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

const USER_PATH = '/api/v1/user/restaurants';
const PUBLIC_PATH = '/api/v1/public/restaurants';

export async function listRestaurantsPublic(
	fetcher: Fetcher,
	options: { cursor?: string; size?: number } = {}
): Promise<RestaurantsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const url = qs.size > 0 ? `${PUBLIC_PATH}?${qs}` : PUBLIC_PATH;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<RestaurantsPageResponse>(res);
}

export async function getRestaurantPublic(
	fetcher: Fetcher,
	id: string
): Promise<RestaurantResponse> {
	const res = await fetcher(`${PUBLIC_PATH}/${encodeURIComponent(id)}`, {
		headers: { Accept: 'application/json' }
	});
	return parseOrThrow<RestaurantResponse>(res);
}

export async function createRestaurant(
	fetcher: Fetcher,
	body: CreateRestaurantRequest
): Promise<RestaurantResponse> {
	const res = await fetcher(USER_PATH, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	return parseOrThrow<RestaurantResponse>(res);
}
