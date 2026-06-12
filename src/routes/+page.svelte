<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import RestaurantList from '$lib/components/RestaurantList.svelte';
	import CreateRestaurantModal from '$lib/components/CreateRestaurantModal.svelte';
	import SortMenu, { type SortKey, type SortOption } from '$lib/components/SortMenu.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';
	import RestaurantFilters, {
		emptyFilterState,
		type FilterState
	} from '$lib/components/RestaurantFilters.svelte';
	import {
		getRestaurantPublic,
		listRestaurantsPublic,
		type RestaurantsPublicSort
	} from '$lib/api/restaurants';
	import { getMyReview } from '$lib/api/reviews';
	import type { PageMeta, PhotoResponse, RestaurantResponse, ReviewResponse } from '$lib/api/types';
	import { loadSortLocation, saveSortLocation, type SortLocation } from '$lib/sortLocation';
	import { appendFilterState } from '$lib/filterState';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let restaurants = $state<RestaurantResponse[]>(data.restaurants);
	// svelte-ignore state_referenced_locally
	let meta = $state<PageMeta>(data.meta);
	// svelte-ignore state_referenced_locally
	let myReviews = $state<Record<string, ReviewResponse | null>>({ ...data.myReviews });
	// svelte-ignore state_referenced_locally
	let filters = $state<FilterState>(data.filters ?? emptyFilterState());
	let modalOpen = $state(false);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);

	$effect(() => {
		restaurants = data.restaurants;
		meta = data.meta;
		myReviews = { ...data.myReviews };
		filters = data.filters ?? emptyFilterState();
		loadMoreError = null;
	});

	const isAuthed = $derived(!!data.user);
	const userId = $derived(data.user?.sub ?? null);
	const isAdmin = $derived(data.user?.roles.includes('ADMIN') ?? false);

	const currentSort = $derived<SortKey>(data.sort ?? 'CREATED_AT_DESC');
	const currentLat = $derived<number | undefined>(data.lat);
	const currentLng = $derived<number | undefined>(data.lng);
	const isDistance = $derived(currentSort === 'DISTANCE_ASC');

	let pickerOpen = $state(false);

	const options = $derived<SortOption[]>([
		{ key: 'CREATED_AT_DESC', label: m.sort_newest() },
		{ key: 'RATING_DESC', label: m.sort_rating() },
		{ key: 'DISTANCE_ASC', label: m.sort_distance() },
		{
			key: 'AFFINITY_DESC',
			label: m.sort_affinity(),
			disabled: !isAuthed,
			disabledReason: isAuthed ? undefined : m.sort_disabled_signin()
		},
		{ key: 'NAME_ASC', label: m.sort_name() }
	]);

	function navigateTo(
		sort: SortKey,
		lat?: number,
		lng?: number,
		nextFilters: FilterState = filters
	) {
		const qs = new SvelteURLSearchParams();
		if (sort !== 'CREATED_AT_DESC') qs.set('sort', sort);
		if (sort === 'DISTANCE_ASC' && lat != null && lng != null) {
			qs.set('lat', String(lat));
			qs.set('lng', String(lng));
		}
		appendFilterState(qs, nextFilters);
		const target = (qs.size > 0 ? `/?${qs}` : '/') as Pathname;
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
			const next = await listRestaurantsPublic(fetch, {
				cursor: meta.nextCursor,
				size: meta.size,
				sort: currentSort as RestaurantsPublicSort,
				lat: currentLat,
				lng: currentLng,
				tagGroups: filters.tagGroups,
				name: filters.name,
				dineIn: filters.dineIn,
				takeOut: filters.takeOut,
				delivery: filters.delivery
			});
			restaurants = [...restaurants, ...next.data];
			meta = next.page;
			if (userId && next.data.length > 0) {
				const entries = await Promise.all(
					next.data.map(async (r) => {
						try {
							return [r.id, await getMyReview(fetch, r.id)] as const;
						} catch {
							return [r.id, null] as const;
						}
					})
				);
				const merged = { ...myReviews };
				for (const [id, review] of entries) merged[id] = review;
				myReviews = merged;
			}
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}

	function handleCreated(restaurant: RestaurantResponse, photos: PhotoResponse[]) {
		restaurants = [restaurant, ...restaurants];
		myReviews = { ...myReviews, [restaurant.id]: null };
		// PhotoResponse has no signed URL — refetch the restaurant so its
		// backend-built thumbnail surfaces without a full page reload.
		if (photos.length > 0 && restaurant.thumbnail == null) {
			getRestaurantPublic(fetch, restaurant.id)
				.then((fresh) => {
					restaurants = restaurants.map((r) => (r.id === fresh.id ? fresh : r));
				})
				.catch(() => {});
		}
	}

	function handleReviewChange(review: ReviewResponse) {
		myReviews = { ...myReviews, [review.restaurantId]: review };
	}

	function handleDeleted(id: string) {
		restaurants = restaurants.filter((r) => r.id !== id);
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
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative">
				<SortMenu value={currentSort} {options} onchange={handleSortChange} />
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
			{#if isAuthed}
				<button
					type="button"
					onclick={() => (modalOpen = true)}
					class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
				>
					+ {m.restaurant_add()}
				</button>
			{:else}
				<a
					href={resolve('/auth/login')}
					class="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
				>
					{m.home_signin_to_add()}
				</a>
			{/if}
		</div>
	</div>

	<div class="mb-6">
		<RestaurantFilters bind:value={filters} onapply={handleFiltersApply} />
	</div>

	<RestaurantList
		{restaurants}
		{meta}
		loading={loadingMore}
		error={loadMoreError}
		showMyReview={isAuthed}
		{isAdmin}
		{userId}
		{myReviews}
		onreviewchange={handleReviewChange}
		ondelete={handleDeleted}
		onloadmore={handleLoadMore}
	/>
</main>

{#if isAuthed}
	<CreateRestaurantModal bind:open={modalOpen} oncreated={handleCreated} />
{/if}
