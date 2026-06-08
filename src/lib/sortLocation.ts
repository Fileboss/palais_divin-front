export type SortLocation = { label: string; lat: number; lng: number };

const KEY = 'pd_sort_location';

export function loadSortLocation(): SortLocation | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<SortLocation>;
		if (
			typeof parsed.label === 'string' &&
			typeof parsed.lat === 'number' &&
			typeof parsed.lng === 'number' &&
			Number.isFinite(parsed.lat) &&
			Number.isFinite(parsed.lng)
		) {
			return { label: parsed.label, lat: parsed.lat, lng: parsed.lng };
		}
		return null;
	} catch {
		return null;
	}
}

export function saveSortLocation(loc: SortLocation): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(KEY, JSON.stringify(loc));
	} catch {
		// quota / private mode — ignore
	}
}

export function clearSortLocation(): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
