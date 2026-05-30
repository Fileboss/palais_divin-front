import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || token.trim().length === 0) {
		error(400, 'Missing invitation token');
	}
	return { token };
};
