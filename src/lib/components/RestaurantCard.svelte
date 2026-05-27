<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import type { RestaurantResponse } from '$lib/api/types';

	let { restaurant }: { restaurant: RestaurantResponse } = $props();

	const createdAt = $derived(
		new Date(restaurant.createdAt).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	);
</script>

<article
	class="flex flex-row overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
>
	<div class="flex flex-1 flex-col gap-2 p-4">
		<h3 class="text-base font-semibold text-stone-900">{restaurant.name}</h3>
		{#if restaurant.address}
			<p class="text-sm text-stone-600">{restaurant.address}</p>
		{/if}
		<p class="text-sm text-stone-300 font-medium">— / 10</p>
		<p class="mt-auto text-xs text-stone-400">
			{restaurant.location.latitude.toFixed(4)}, {restaurant.location.longitude.toFixed(4)}
			<span class="mx-1" aria-hidden="true">·</span>
			<time datetime={restaurant.createdAt}>{createdAt}</time>
		</p>
	</div>

	<div class="w-px self-stretch bg-stone-100"></div>

	<div class="flex w-44 flex-shrink-0 flex-col gap-2 p-4">
		<p class="text-xs font-medium uppercase tracking-wide text-stone-400">My Review</p>
	</div>
</article>
