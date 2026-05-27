<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref, getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	const currentLocale = $derived(getLocale());
</script>

<header
	class="border-b border-stone-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
>
	<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
		<a href={resolve('/')} class="text-lg font-semibold tracking-tight text-stone-900">
			{m.brand_name()}
		</a>

		<nav class="flex items-center gap-6">
			<a
				href={resolve('/')}
				class="text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
				aria-current={page.url.pathname === '/' ? 'page' : undefined}
			>
				{m.nav_home()}
			</a>

			<div class="flex items-center gap-1 text-xs text-stone-500">
				{#each locales as locale, i (locale)}
					{#if i > 0}<span aria-hidden="true">·</span>{/if}
					<a
						href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}
						class="uppercase hover:text-stone-900"
						class:font-semibold={locale === currentLocale}
						class:text-stone-900={locale === currentLocale}
					>
						{locale}
					</a>
				{/each}
			</div>
		</nav>
	</div>
</header>
