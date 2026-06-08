import {
	ApiError,
	parseProblem,
	type CreateRestaurantRequest,
	type RestaurantAffinityResponse,
	type RestaurantResponse,
	type RestaurantsPageResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(res.status, `${res.status} ${res.statusText}`, problem ?? undefined);
	}
	return (await res.json()) as T;
}

const USER_PATH = '/api/v1/user/restaurants';
const PUBLIC_PATH = '/api/v1/public/restaurants';

export type RestaurantsPublicSort =
	| 'CREATED_AT_DESC'
	| 'RATING_DESC'
	| 'NAME_ASC'
	| 'DISTANCE_ASC'
	| 'AFFINITY_DESC';

export async function listRestaurantsPublic(
	fetcher: Fetcher,
	options: {
		cursor?: string;
		size?: number;
		sort?: RestaurantsPublicSort;
		lat?: number;
		lng?: number;
	} = {}
): Promise<RestaurantsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	if (options.sort) qs.set('sort', options.sort);
	if (options.lat != null) qs.set('lat', String(options.lat));
	if (options.lng != null) qs.set('lng', String(options.lng));
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

export async function getRestaurantAffinity(
	fetcher: Fetcher,
	id: string
): Promise<RestaurantAffinityResponse> {
	const res = await fetcher(`${USER_PATH}/${encodeURIComponent(id)}/affinity`, {
		headers: { Accept: 'application/json' }
	});
	return parseOrThrow<RestaurantAffinityResponse>(res);
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

const ADMIN_PATH = '/api/v1/admin/restaurants';

export async function deleteRestaurant(fetcher: Fetcher, id: string): Promise<void> {
	const res = await fetcher(`${ADMIN_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
	if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
}
