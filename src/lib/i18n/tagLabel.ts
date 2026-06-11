import { getLocale } from '$lib/paraglide/runtime';

type Localizable = { label: string; labelI18n?: Record<string, string> };

export function tagLabel(tag: Localizable, locale: string = getLocale()): string {
	return tag.labelI18n?.[locale] ?? tag.labelI18n?.['en'] ?? tag.label;
}
