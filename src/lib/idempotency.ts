function uuidv4(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

const PREFIX = 'idempotency_key:';

export function getOrCreateKey(scopeKey: string): string {
	const storageKey = PREFIX + scopeKey;
	const existing = sessionStorage.getItem(storageKey);
	if (existing) return existing;
	const key = uuidv4();
	sessionStorage.setItem(storageKey, key);
	return key;
}

export function clearKey(scopeKey: string): void {
	sessionStorage.removeItem(PREFIX + scopeKey);
}
