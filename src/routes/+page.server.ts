import { error, redirect } from '@sveltejs/kit';
import { listRestaurantsPublic } from '$lib/api/restaurants';
import { ApiError } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	try {
		const { data, page } = await listRestaurantsPublic(fetch, { size: 20 });
		return { restaurants: data, meta: page };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		error(503, 'Backend unavailable');
	}
};
