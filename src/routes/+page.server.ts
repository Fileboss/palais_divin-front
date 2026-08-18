import { error, redirect } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';
import { listRestaurantsPublic, type RestaurantsPublicSort } from '$lib/api/restaurants';
import { listMyReviewsBatch } from '$lib/api/reviews';
import { ApiError, type ReviewResponse } from '$lib/api/types';
import { parseFilterState } from '$lib/filterState';
import { loginUrlFor, parseCoord, parseSortFactory } from '$lib/server/listPageParams';
import type { PageServerLoad } from './$types';

const VALID_SORTS: RestaurantsPublicSort[] = [
	'CREATED_AT_DESC',
	'RATING_DESC',
	'NAME_ASC',
	'DISTANCE_ASC',
	'AFFINITY_DESC'
];

const parseSort = parseSortFactory(VALID_SORTS, 'CREATED_AT_DESC');

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	const isAuthRetry = url.searchParams.get('auth_retry') === '1';
	const requestedSort = parseSort(url.searchParams.get('sort'));
	const sort: RestaurantsPublicSort =
		requestedSort === 'AFFINITY_DESC' && !locals.session ? 'CREATED_AT_DESC' : requestedSort;
	const lat = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lat')) : undefined;
	const lng = sort === 'DISTANCE_ASC' ? parseCoord(url.searchParams.get('lng')) : undefined;
	const filters = parseFilterState(url.searchParams);
	try {
		const { data, page } = await listRestaurantsPublic(fetch, {
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
		let myReviews: Record<string, ReviewResponse | null> = {};
		if (locals.session?.sub && data.length > 0) {
			try {
				myReviews = await listMyReviewsBatch(
					fetch,
					data.map((r) => r.id)
				);
			} catch {
				myReviews = {};
			}
		}
		return { restaurants: data, meta: page, myReviews, sort, lat, lng, filters };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			if (isAuthRetry) error(403, m.error_auth_failed_page());
			redirect(302, loginUrlFor(url));
		}
		if (
			err instanceof ApiError &&
			typeof err.problem?.type === 'string' &&
			err.problem.type.endsWith('/problems/affinity-requires-auth')
		) {
			if (isAuthRetry) error(403, m.error_auth_failed_page());
			redirect(302, loginUrlFor(url));
		}
		if (err instanceof ApiError) {
			console.error('[home load] upstream error', {
				sort,
				status: err.status,
				problemType: err.problem?.type,
				problemTitle: err.problem?.title,
				message: err.message
			});
		} else {
			console.error('[home load] unexpected error', err);
		}
		error(503, m.error_backend_unavailable());
	}
};
