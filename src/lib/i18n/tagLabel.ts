import { getLocale } from '$lib/paraglide/runtime';

type Localizable = { label: string; labelI18n?: Record<string, string> };

export function tagLabel(tag: Localizable, locale: string = getLocale()): string {
	if (locale === 'fr') return tag.labelI18n?.fr ?? tag.label;
	return tag.labelI18n?.[locale] ?? tag.labelI18n?.en ?? tag.label;
}
