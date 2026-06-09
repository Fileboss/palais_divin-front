export interface RestaurantFilterParams {
	tagGroups?: string[][];
	name?: string;
	dineIn?: boolean;
	takeOut?: boolean;
	delivery?: boolean;
}

export function appendRestaurantFilterParams(
	qs: URLSearchParams,
	filters: RestaurantFilterParams
): void {
	if (filters.tagGroups) {
		for (const group of filters.tagGroups) {
			const cleaned = group.map((s) => s.trim()).filter((s) => s.length > 0);
			if (cleaned.length > 0) qs.append('tag', cleaned.join(','));
		}
	}
	if (filters.name != null) {
		const trimmed = filters.name.trim();
		if (trimmed.length > 0) qs.set('name', trimmed);
	}
	if (filters.dineIn != null) qs.set('dineIn', String(filters.dineIn));
	if (filters.takeOut != null) qs.set('takeOut', String(filters.takeOut));
	if (filters.delivery != null) qs.set('delivery', String(filters.delivery));
}
