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
	class="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md"
>
	<h3 class="text-base font-semibold text-stone-900">{restaurant.name}</h3>
	{#if restaurant.address}
		<p class="text-sm text-stone-600">{restaurant.address}</p>
	{/if}
	<p class="mt-auto text-xs text-stone-400">
		{restaurant.location.latitude.toFixed(4)}, {restaurant.location.longitude.toFixed(4)}
		<span class="mx-1" aria-hidden="true">·</span>
		<time datetime={restaurant.createdAt}>{createdAt}</time>
	</p>
</article>
