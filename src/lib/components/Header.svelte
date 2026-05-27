<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref, getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	const flagMap: Record<string, string> = {
		fr: '🇫🇷',
		en: '🇬🇧',
		es: '🇪🇸',
		de: '🇩🇪',
		zh: '🇨🇳',
		ko: '🇰🇷',
		ja: '🇯🇵'
	};

	const currentLocale = $derived(getLocale());
	let open = $state(false);
	let el = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const handler = (e: MouseEvent) => {
			if (el && !el.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', handler);
		return () => document.removeEventListener('click', handler);
	});
</script>

<header
	class="border-b border-stone-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
>
	<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
		<a href={resolve('/')} class="text-lg font-semibold tracking-tight text-stone-900">
			{m.brand_name()} 🦩
		</a>

		<nav class="flex items-center gap-6">
			<a
				href={resolve('/')}
				class="text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
				aria-current={page.url.pathname === '/' ? 'page' : undefined}
			>
				{m.nav_home()}
			</a>

			<div bind:this={el} class="relative">
				<button
					type="button"
					onclick={() => (open = !open)}
					class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
					aria-haspopup="listbox"
					aria-expanded={open}
				>
					<span>{flagMap[currentLocale] ?? ''}</span>
					<span class="uppercase">{currentLocale}</span>
					<svg
						class="h-3 w-3 text-stone-400"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M2 4l4 4 4-4" />
					</svg>
				</button>

				{#if open}
					<div
						class="absolute right-0 top-full z-50 mt-1 min-w-[7rem] overflow-hidden rounded-md border border-stone-200 bg-white shadow-md"
						role="listbox"
					>
						{#each locales as locale (locale)}
							<a
								href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}
								role="option"
								aria-selected={locale === currentLocale}
								onclick={() => (open = false)}
								class="flex items-center gap-2 px-3 py-2 text-xs hover:bg-stone-50"
								class:font-semibold={locale === currentLocale}
								class:text-stone-900={locale === currentLocale}
								class:text-stone-500={locale !== currentLocale}
							>
								<span>{flagMap[locale] ?? ''}</span>
								<span class="uppercase">{locale}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</nav>
	</div>
</header>
