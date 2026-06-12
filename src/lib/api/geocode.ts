import { ApiError, type GeocodeMatch } from './types';

type Fetcher = typeof fetch;

export async function searchGeocode(
	fetcher: Fetcher,
	q: string,
	limit = 5,
	signal?: AbortSignal
): Promise<GeocodeMatch[]> {
	const qs = new URLSearchParams({ q, limit: String(limit) });
	const res = await fetcher(`/api/v1/public/geocode?${qs}`, {
		headers: { Accept: 'application/json' },
		signal
	});
	if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	return (await res.json()) as GeocodeMatch[];
}
