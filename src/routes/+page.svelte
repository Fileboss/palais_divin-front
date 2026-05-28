<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import RestaurantList from '$lib/components/RestaurantList.svelte';
	import CreateRestaurantModal from '$lib/components/CreateRestaurantModal.svelte';
	import { listRestaurants } from '$lib/api/restaurants';
	import type { PageMeta, RestaurantResponse } from '$lib/api/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local writable copy of the SSR snapshot; mutated by load-more and create.
	// svelte-ignore state_referenced_locally
	let restaurants = $state<RestaurantResponse[]>(data.restaurants);
	// svelte-ignore state_referenced_locally
	let meta = $state<PageMeta>(data.meta);
	let modalOpen = $state(false);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);

	async function handleLoadMore() {
		if (!meta.hasNext || !meta.nextCursor || loadingMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const next = await listRestaurants(fetch, { cursor: meta.nextCursor, size: meta.size });
			restaurants = [...restaurants, ...next.data];
			meta = next.page;
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}

	function handleCreated(restaurant: RestaurantResponse) {
		restaurants = [restaurant, ...restaurants];
	}
</script>

<svelte:head>
	<title>{m.home_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-stone-900">{m.home_title()}</h1>
			<p class="mt-1 text-sm text-stone-600">{m.home_subtitle()}</p>
		</div>
		<button
			type="button"
			onclick={() => (modalOpen = true)}
			class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
		>
			+ {m.restaurant_add()}
		</button>
	</div>

	<RestaurantList
		{restaurants}
		{meta}
		loading={loadingMore}
		error={loadMoreError}
		onloadmore={handleLoadMore}
	/>
</main>

<CreateRestaurantModal bind:open={modalOpen} oncreated={handleCreated} />
