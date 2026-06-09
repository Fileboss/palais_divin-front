import { redirect, error } from '@sveltejs/kit';
import { listRecommendations, type RecommendationsSort } from '$lib/api/recommendations';
import { ApiError } from '$lib/api/types';
import { parseFilterState } from '$lib/filterState';
import type { PageServerLoad } from './$types';

const VALID_SORTS: RecommendationsSort[] = [
	'AFFINITY_DESC',
	'RATING_DESC',
	'NAME_ASC',
	'DISTANCE_ASC',
	'CREATED_AT_DESC'
];

function parseSort(raw: string | null): RecommendationsSort {
	if (!raw) return 'AFFINITY_DESC';
	return (VALID_SORTS as string[]).includes(raw) ? (raw as RecommendationsSort) : 'AFFINITY_DESC';
}

function parseCoord(raw: string | null): number | undefined {
	if (raw == null) return undefined;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) ? n : undefined;
}

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	if (!locals.session) {
		redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const sort = parseSort(url.searchParams.get('sort'));
	const lat = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lat')) : undefined;
	const lng = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lng')) : undefined;
	const filters = parseFilterState(url.searchParams);
	try {
		const { data, page } = await listRecommendations(fetch, {
			size: 20,
			sort,
			lat,
			lng,
			tagGroups: filters.tagGroups,
			name: filters.name,
			dineIn: filters.dineIn,
			takeOut: filters.takeOut,
			delivery: filters.delivery
		});
		return { recommendations: data, meta: page, sort, lat, lng, filters };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		if (err instanceof ApiError) {
			console.error('[recommendations load] upstream error', {
				sort,
				lat,
				lng,
				status: err.status,
				problem: err.problem,
				message: err.message
			});
		} else {
			console.error('[recommendations load] unexpected error', err);
		}
		error(503, 'Backend unavailable');
	}
};
