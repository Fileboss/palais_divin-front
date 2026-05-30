import { ApiError, parseProblem, type SignupRequest, type SignupResponse } from './types';

type Fetcher = typeof fetch;

const PATH = '/api/v1/public/signup';

export async function signup(fetcher: Fetcher, body: SignupRequest): Promise<SignupResponse> {
	const res = await fetcher(PATH, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(
			res.status,
			problem?.title ?? `${res.status} ${res.statusText}`,
			problem ?? undefined
		);
	}
	return (await res.json()) as SignupResponse;
}

export function problemTypeSuffix(type: string | undefined): string | null {
	if (!type) return null;
	const trimmed = type.replace(/\/+$/, '');
	const slash = trimmed.lastIndexOf('/');
	return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}
