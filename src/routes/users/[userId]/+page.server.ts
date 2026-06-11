import { error } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';
import { getPublicUser, listAuthorReviewsPublic } from '$lib/api/users';
import { listMyFollowing } from '$lib/api/connections';
import { ApiError, type FollowingResponse, type PageMeta } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, params }) => {
	const isOwnProfile = locals.session?.sub === params.userId;
	try {
		const [user, reviewsPage] = await Promise.all([
			getPublicUser(fetch, params.userId),
			listAuthorReviewsPublic(fetch, params.userId, { size: 20 })
		]);
		let following: FollowingResponse[] | null = null;
		let followingMeta: PageMeta | null = null;
		if (isOwnProfile) {
			const page = await listMyFollowing(fetch, { size: 20 });
			following = page.data;
			followingMeta = page.page;
		}
		return {
			profile: user,
			reviews: reviewsPage.data,
			reviewsMeta: reviewsPage.page,
			isOwnProfile,
			following,
			followingMeta
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			error(404, m.error_user_not_found());
		}
		error(503, 'Backend unavailable');
	}
};
