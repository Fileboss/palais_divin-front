import {
	ApiError,
	parseProblem,
	type ConnectionResponse,
	type FollowingPageResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(res.status, `${res.status} ${res.statusText}`, problem ?? undefined);
	}
	return (await res.json()) as T;
}

const BASE = '/api/v1/user/connections';

export async function follow(fetcher: Fetcher, targetId: string): Promise<ConnectionResponse> {
	const res = await fetcher(`${BASE}/${encodeURIComponent(targetId)}`, {
		method: 'POST',
		headers: { Accept: 'application/json' }
	});
	return parseOrThrow<ConnectionResponse>(res);
}

export async function unfollow(fetcher: Fetcher, targetId: string): Promise<void> {
	const res = await fetcher(`${BASE}/${encodeURIComponent(targetId)}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
}

export async function listMyFollowing(
	fetcher: Fetcher,
	options: { cursor?: string; size?: number } = {}
): Promise<FollowingPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const url = qs.size > 0 ? `${BASE}?${qs}` : BASE;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<FollowingPageResponse>(res);
}
