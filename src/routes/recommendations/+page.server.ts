import { redirect, error } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';
import { listRecommendations, type RecommendationsSort } from '$lib/api/recommendations';
import { listMyReviewsBatch } from '$lib/api/reviews';
import { ApiError, type ReviewResponse } from '$lib/api/types';
import { parseFilterState } from '$lib/filterState';
import { loginUrlFor, parseCoord, parseSortFactory } from '$lib/server/listPageParams';
import type { PageServerLoad } from './$types';

const VALID_SORTS: RecommendationsSort[] = [
	'AFFINITY_DESC',
	'RATING_DESC',
	'NAME_ASC',
	'DISTANCE_ASC',
	'CREATED_AT_DESC'
];

const parseSort = parseSortFactory(VALID_SORTS, 'AFFINITY_DESC');

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	const isAuthRetry = url.searchParams.get('auth_retry') === '1';
	if (!locals.session) {
		if (isAuthRetry) error(403, m.error_auth_failed_page());
		redirect(302, loginUrlFor(url));
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
		let myReviews: Record<string, ReviewResponse | null> = {};
		if (data.length > 0) {
			try {
				myReviews = await listMyReviewsBatch(
					fetch,
					data.map((r) => r.id)
				);
			} catch {
				myReviews = {};
			}
		}
		return { recommendations: data, meta: page, myReviews, sort, lat, lng, filters };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			if (isAuthRetry) error(403, m.error_auth_failed_page());
			redirect(302, loginUrlFor(url));
		}
		if (err instanceof ApiError) {
			console.error('[recommendations load] upstream error', {
				sort,
				lat,
				lng,
				status: err.status,
				problemType: err.problem?.type,
				problemTitle: err.problem?.title,
				message: err.message
			});
		} else {
			console.error('[recommendations load] unexpected error', err);
		}
		error(503, m.error_backend_unavailable());
	}
};
