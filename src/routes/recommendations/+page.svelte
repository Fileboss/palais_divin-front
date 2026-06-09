<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';
	import SortMenu, { type SortKey, type SortOption } from '$lib/components/SortMenu.svelte';
	import RestaurantFilters, {
		emptyFilterState,
		type FilterState
	} from '$lib/components/RestaurantFilters.svelte';
	import { listRecommendations, type RecommendationsSort } from '$lib/api/recommendations';
	import { loadSortLocation, saveSortLocation, type SortLocation } from '$lib/sortLocation';
	import { appendFilterState } from '$lib/filterState';
	import type { PageData } from './$types';
	import type { PageMeta, RecommendationResponse } from '$lib/api/types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let recommendations = $state<RecommendationResponse[]>(data.recommendations);
	// svelte-ignore state_referenced_locally
	let meta = $state<PageMeta>(data.meta);
	// svelte-ignore state_referenced_locally
	let filters = $state<FilterState>(data.filters ?? emptyFilterState());
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);
	let pickerOpen = $state(false);

	$effect(() => {
		recommendations = data.recommendations;
		meta = data.meta;
		filters = data.filters ?? emptyFilterState();
		loadMoreError = null;
	});

	const currentSort = $derived<SortKey>(data.sort ?? 'AFFINITY_DESC');
	const currentLat = $derived<number | undefined>(data.lat);
	const currentLng = $derived<number | undefined>(data.lng);
	const isDistance = $derived(currentSort === 'DISTANCE_ASC');

	const sortOptions = $derived<SortOption[]>([
		{ key: 'AFFINITY_DESC', label: m.sort_affinity() },
		{ key: 'RATING_DESC', label: m.sort_rating() },
		{ key: 'NAME_ASC', label: m.sort_name() },
		{ key: 'DISTANCE_ASC', label: m.sort_distance() },
		{ key: 'CREATED_AT_DESC', label: m.sort_newest() }
	]);

	function navigateTo(
		sort: SortKey,
		lat?: number,
		lng?: number,
		nextFilters: FilterState = filters
	) {
		const qs = new SvelteURLSearchParams();
		if (sort !== 'AFFINITY_DESC') qs.set('sort', sort);
		if (sort === 'DISTANCE_ASC' && lat != null && lng != null) {
			qs.set('lat', String(lat));
			qs.set('lng', String(lng));
		}
		appendFilterState(qs, nextFilters);
		const target = (qs.size > 0 ? `/recommendations?${qs}` : '/recommendations') as Pathname;
		goto(resolve(target), { keepFocus: true, noScroll: true, invalidateAll: true });
	}

	function handleSortChange(key: SortKey) {
		if (key === 'DISTANCE_ASC') {
			const stored = loadSortLocation();
			if (stored) {
				navigateTo('DISTANCE_ASC', stored.lat, stored.lng);
			} else {
				pickerOpen = true;
			}
			return;
		}
		navigateTo(key);
	}

	function handleLocationPicked(loc: SortLocation) {
		saveSortLocation(loc);
		pickerOpen = false;
		navigateTo('DISTANCE_ASC', loc.lat, loc.lng);
	}

	function handleFiltersApply(next: FilterState) {
		filters = next;
		navigateTo(currentSort, currentLat, currentLng, next);
	}

	async function handleLoadMore() {
		if (!meta.hasNext || !meta.nextCursor || loadingMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const next = await listRecommendations(fetch, {
				cursor: meta.nextCursor,
				size: meta.size,
				sort: currentSort as RecommendationsSort,
				lat: currentLat,
				lng: currentLng,
				tagGroups: filters.tagGroups,
				name: filters.name,
				dineIn: filters.dineIn,
				takeOut: filters.takeOut,
				delivery: filters.delivery
			});
			recommendations = [...recommendations, ...next.data];
			meta = next.page;
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}

	function formatDistance(metres: number): string {
		if (metres < 1000) return m.distance_m({ value: Math.round(metres) });
		const km = metres / 1000;
		return m.distance_km({
			value: km.toLocaleString(getLocale(), {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1
			})
		});
	}

	function formatRating(value: number): string {
		return value.toLocaleString(getLocale(), {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		});
	}
</script>

<svelte:head>
	<title>{m.recommendations_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-stone-900">{m.recommendations_title()}</h1>
			<p class="mt-1 text-sm text-stone-600">{m.recommendations_subtitle()}</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative">
				<SortMenu value={currentSort} options={sortOptions} onchange={handleSortChange} />
				<LocationPicker
					open={pickerOpen}
					onpick={handleLocationPicked}
					onclose={() => (pickerOpen = false)}
				/>
			</div>
			{#if isDistance}
				<button
					type="button"
					onclick={() => (pickerOpen = true)}
					class="text-xs font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
				>
					{m.sort_loc_change()}
				</button>
			{/if}
		</div>
	</div>

	<div class="mb-6">
		<RestaurantFilters bind:value={filters} onapply={handleFiltersApply} />
	</div>

	{#if recommendations.length === 0}
		<p
			class="rounded-md border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500"
		>
			{m.recommendations_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each recommendations as rec (rec.id)}
				<li>
					<a
						href={resolve(`/restaurants/${rec.id}`)}
						class="flex flex-row overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
					>
						<div class="flex flex-1 flex-col gap-2 p-4">
							<h3 class="text-base font-semibold text-stone-900">{rec.name}</h3>
							{#if rec.address}
								<p class="text-sm text-stone-600">{rec.address}</p>
							{/if}
							<p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
								{#if typeof rec.avgRating === 'number' && rec.avgRating > 0}
									<span>
										<span class="text-amber-400" aria-hidden="true">★</span>
										<span class="font-medium text-stone-700">{formatRating(rec.avgRating)}</span>
									</span>
								{/if}
								{#if typeof rec.distanceMetres === 'number'}
									<span class="text-stone-500">{formatDistance(rec.distanceMetres)}</span>
								{/if}
							</p>
							<p class="text-sm font-medium text-emerald-600">
								{m.recommendations_recommenders({ count: rec.recommenderCount })}
							</p>
						</div>
						<div class="flex w-32 flex-shrink-0 flex-col items-end justify-center gap-1 p-4">
							<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">
								{m.recommendations_affinity()}
							</p>
							<p class="text-xl font-bold text-stone-800">{rec.affinity.toFixed(1)}</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if loadMoreError}
		<p class="mt-4 text-sm text-red-600" role="alert">{loadMoreError}</p>
	{/if}

	{#if meta.hasNext}
		<div class="mt-6 flex justify-center">
			<button
				type="button"
				onclick={handleLoadMore}
				disabled={loadingMore}
				class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loadingMore ? m.restaurant_loading() : m.restaurant_load_more()}
			</button>
		</div>
	{/if}
</main>
