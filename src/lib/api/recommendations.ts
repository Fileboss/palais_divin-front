import { ApiError, type RecommendationsPageResponse } from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

export type RecommendationsSort =
	| 'AFFINITY_DESC'
	| 'RATING_DESC'
	| 'NAME_ASC'
	| 'DISTANCE_ASC'
	| 'CREATED_AT_DESC';

export async function listRecommendations(
	fetcher: Fetcher,
	options: {
		cursor?: string;
		size?: number;
		sort?: RecommendationsSort;
		lat?: number;
		lng?: number;
	} = {}
): Promise<RecommendationsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	if (options.sort) qs.set('sort', options.sort);
	if (options.lat != null) qs.set('lat', String(options.lat));
	if (options.lng != null) qs.set('lng', String(options.lng));
	const url = qs.size > 0 ? `/api/v1/user/recommendations?${qs}` : '/api/v1/user/recommendations';
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<RecommendationsPageResponse>(res);
}
