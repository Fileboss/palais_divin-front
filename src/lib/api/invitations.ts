import { ApiError, parseProblem, type InvitationResponse } from './types';

type Fetcher = typeof fetch;

const BASE_PATH = '/api/v1/admin/invitations';

export async function createInvitation(fetcher: Fetcher): Promise<InvitationResponse> {
	const res = await fetcher(BASE_PATH, {
		method: 'POST',
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(
			res.status,
			problem?.title ?? `${res.status} ${res.statusText}`,
			problem ?? undefined
		);
	}
	return (await res.json()) as InvitationResponse;
}
