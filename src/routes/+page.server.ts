import { error, redirect } from '@sveltejs/kit';
import { listRestaurantsPublic, type RestaurantsPublicSort } from '$lib/api/restaurants';
import { getMyReview } from '$lib/api/reviews';
import { ApiError, type ReviewResponse } from '$lib/api/types';
import type { PageServerLoad } from './$types';

const VALID_SORTS: RestaurantsPublicSort[] = [
	'CREATED_AT_DESC',
	'RATING_DESC',
	'NAME_ASC',
	'DISTANCE_ASC',
	'AFFINITY_DESC'
];

function parseSort(raw: string | null): RestaurantsPublicSort {
	if (!raw) return 'CREATED_AT_DESC';
	return (VALID_SORTS as string[]).includes(raw)
		? (raw as RestaurantsPublicSort)
		: 'CREATED_AT_DESC';
}

function parseCoord(raw: string | null): number | undefined {
	if (raw == null) return undefined;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) ? n : undefined;
}

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	const requestedSort = parseSort(url.searchParams.get('sort'));
	const sort: RestaurantsPublicSort =
		requestedSort === 'AFFINITY_DESC' && !locals.session ? 'CREATED_AT_DESC' : requestedSort;
	const lat = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lat')) : undefined;
	const lng = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lng')) : undefined;
	try {
		const { data, page } = await listRestaurantsPublic(fetch, {
			size: 20,
			sort,
			lat,
			lng
		});
		const myReviews: Record<string, ReviewResponse | null> = {};
		const sub = locals.session?.sub;
		if (sub && data.length > 0) {
			const entries = await Promise.all(
				data.map(async (r) => {
					try {
						return [r.id, await getMyReview(fetch, r.id)] as const;
					} catch {
						return [r.id, null] as const;
					}
				})
			);
			for (const [id, review] of entries) myReviews[id] = review;
		}
		return { restaurants: data, meta: page, myReviews, sort, lat, lng };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		if (
			err instanceof ApiError &&
			typeof err.problem?.type === 'string' &&
			err.problem.type.endsWith('/problems/affinity-requires-auth')
		) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		if (err instanceof ApiError) {
			console.error('[home load] upstream error', {
				sort,
				status: err.status,
				problem: err.problem,
				message: err.message
			});
		} else {
			console.error('[home load] unexpected error', err);
		}
		error(503, 'Backend unavailable');
	}
};
