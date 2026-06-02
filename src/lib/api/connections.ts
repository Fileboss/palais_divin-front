import { ApiError, type ConnectionResponse } from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

export async function connect(fetcher: Fetcher, targetId: string): Promise<ConnectionResponse> {
	const res = await fetcher(`/api/v1/user/connections/${encodeURIComponent(targetId)}`, {
		method: 'POST',
		headers: { Accept: 'application/json' }
	});
	return parseOrThrow<ConnectionResponse>(res);
}
