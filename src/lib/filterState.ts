import type { FilterState } from '$lib/components/RestaurantFilters.svelte';

const NAME_MAX = 100;

function parseBool(raw: string | null): boolean | undefined {
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return undefined;
}

export function parseFilterState(searchParams: URLSearchParams): FilterState {
	const tagGroups: string[][] = [];
	for (const raw of searchParams.getAll('tag')) {
		const group = raw
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		if (group.length > 0) tagGroups.push(group);
	}
	const rawName = searchParams.get('name') ?? '';
	const name = rawName.trim().slice(0, NAME_MAX);
	return {
		tagGroups,
		name,
		dineIn: parseBool(searchParams.get('dineIn')),
		takeOut: parseBool(searchParams.get('takeOut')),
		delivery: parseBool(searchParams.get('delivery'))
	};
}

export function appendFilterState(qs: URLSearchParams, state: FilterState): void {
	for (const group of state.tagGroups) {
		const cleaned = group.filter((s) => s.length > 0);
		if (cleaned.length > 0) qs.append('tag', cleaned.join(','));
	}
	const trimmed = state.name.trim();
	if (trimmed.length > 0) qs.set('name', trimmed);
	if (state.dineIn !== undefined) qs.set('dineIn', String(state.dineIn));
	if (state.takeOut !== undefined) qs.set('takeOut', String(state.takeOut));
	if (state.delivery !== undefined) qs.set('delivery', String(state.delivery));
}

export function hasActiveFilters(state: FilterState): boolean {
	return (
		state.tagGroups.some((g) => g.length > 0) ||
		state.name.length > 0 ||
		state.dineIn !== undefined ||
		state.takeOut !== undefined ||
		state.delivery !== undefined
	);
}
