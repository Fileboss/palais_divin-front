import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { listRestaurants } from '$lib/api/restaurants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const { data, page } = await listRestaurants(fetch, {
			size: 20,
			baseUrl: env.API_BASE_URL
		});
		return { restaurants: data, meta: page };
	} catch {
		error(503, 'Backend unavailable');
	}
};
