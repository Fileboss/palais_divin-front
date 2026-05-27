<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { PageMeta, RestaurantResponse } from '$lib/api/types';
	import RestaurantCard from './RestaurantCard.svelte';

	let {
		restaurants,
		meta,
		loading = false,
		error = null,
		onloadmore
	}: {
		restaurants: RestaurantResponse[];
		meta: PageMeta;
		loading?: boolean;
		error?: string | null;
		onloadmore: () => void;
	} = $props();
</script>

{#if restaurants.length === 0}
	<p
		class="rounded-md border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500"
	>
		{m.restaurant_list_empty()}
	</p>
{:else}
	<ul class="flex flex-col gap-3">
		{#each restaurants as restaurant (restaurant.id)}
			<li><RestaurantCard {restaurant} /></li>
		{/each}
	</ul>
{/if}

{#if error}
	<p class="mt-4 text-sm text-red-600" role="alert">{error}</p>
{/if}

{#if meta.hasNext}
	<div class="mt-6 flex justify-center">
		<button
			type="button"
			onclick={onloadmore}
			disabled={loading}
			class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{loading ? m.restaurant_loading() : m.restaurant_load_more()}
		</button>
	</div>
{/if}
