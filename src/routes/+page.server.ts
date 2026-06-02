import { error, redirect } from '@sveltejs/kit';
import { listRestaurantsPublic } from '$lib/api/restaurants';
import { getMyReview } from '$lib/api/reviews';
import { ApiError, type ReviewResponse } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	try {
		const { data, page } = await listRestaurantsPublic(fetch, { size: 20 });
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
		return { restaurants: data, meta: page, myReviews };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		error(503, 'Backend unavailable');
	}
};
