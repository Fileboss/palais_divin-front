import {
	ApiError,
	parseProblem,
	type AuthorReviewsPageResponse,
	type PublicUserResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(res.status, `${res.status} ${res.statusText}`, problem ?? undefined);
	}
	return (await res.json()) as T;
}

const PUBLIC_PATH = '/api/v1/public/users';

export async function getPublicUser(fetcher: Fetcher, userId: string): Promise<PublicUserResponse> {
	const res = await fetcher(`${PUBLIC_PATH}/${encodeURIComponent(userId)}`, {
		headers: { Accept: 'application/json' }
	});
	return parseOrThrow<PublicUserResponse>(res);
}

export async function listAuthorReviewsPublic(
	fetcher: Fetcher,
	userId: string,
	options: { cursor?: string; size?: number } = {}
): Promise<AuthorReviewsPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const base = `${PUBLIC_PATH}/${encodeURIComponent(userId)}/reviews`;
	const url = qs.size > 0 ? `${base}?${qs}` : base;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<AuthorReviewsPageResponse>(res);
}
