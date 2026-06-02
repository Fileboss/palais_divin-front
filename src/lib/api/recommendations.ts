import { ApiError, type RecommendationsPageResponse } from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

export async function listRecommendations(
	fetcher: Fetcher,
	options: { cursor?: string; size?: number } = {}
): Promise<RecommendationsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const url = qs.size > 0 ? `/api/v1/user/recommendations?${qs}` : '/api/v1/user/recommendations';
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<RecommendationsPageResponse>(res);
}
