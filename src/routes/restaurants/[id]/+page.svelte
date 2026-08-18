<script lang="ts">
	import { resolve } from '$app/paths';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import RestaurantTagsEditor from '$lib/components/RestaurantTagsEditor.svelte';
	import ReviewForm from '$lib/components/ReviewForm.svelte';
	import ReviewList from '$lib/components/ReviewList.svelte';
	import { listReviewsPublic } from '$lib/api/reviews';
	import { getRestaurantAffinity } from '$lib/api/restaurants';
	import type { PageData } from './$types';
	import type {
		PageMeta,
		RestaurantAffinityResponse,
		ReviewResponse,
		TagSummary
	} from '$lib/api/types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let reviews = $state<ReviewResponse[]>(data.reviews);
	// svelte-ignore state_referenced_locally
	let reviewsMeta = $state<PageMeta>(data.reviewsMeta);
	// svelte-ignore state_referenced_locally
	let myReview = $state<ReviewResponse | null>(data.myReview);
	// svelte-ignore state_referenced_locally
	let restaurantTags = $state<TagSummary[]>(data.restaurant.tags ?? []);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);
	let affinity = $state<RestaurantAffinityResponse | null>(null);
	let showForm = $state(false);

	const isAuthed = $derived(!!data.user);
	const currentUserId = $derived(data.user?.sub ?? null);

	const createdAt = $derived(
		new Date(data.restaurant.createdAt).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	const avgRatingLabel = $derived(
		typeof data.restaurant.avgRating === 'number' && data.restaurant.avgRating > 0
			? data.restaurant.avgRating.toLocaleString(getLocale(), {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1
				})
			: null
	);

	$effect(() => {
		if (!isAuthed) return;
		affinity = null;
		const controller = new AbortController();
		getRestaurantAffinity(fetch, data.restaurant.id, { signal: controller.signal })
			.then((a) => {
				if (!controller.signal.aborted) affinity = a;
			})
			.catch(() => {});
		return () => controller.abort();
	});

	async function handleLoadMore() {
		if (!reviewsMeta.hasNext || !reviewsMeta.nextCursor || loadingMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const next = await listReviewsPublic(fetch, data.restaurant.id, {
				cursor: reviewsMeta.nextCursor,
				size: reviewsMeta.size
			});
			reviews = [...reviews, ...next.data];
			reviewsMeta = next.page;
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}

	function handleReviewExisting(review: ReviewResponse) {
		myReview = review;
	}

	function handleReviewSaved(review: ReviewResponse) {
		const wasEditing = !!myReview;
		myReview = review;
		if (wasEditing) {
			reviews = reviews.map((r) => (r.id === review.id ? review : r));
		} else {
			reviews = [review, ...reviews];
		}
		showForm = false;
	}
</script>

<svelte:head>
	<title>{data.restaurant.name} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-3xl px-4 py-8">
	<a
		href={resolve('/')}
		class="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
	>
		← {m.nav_home()}
	</a>

	<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-bold text-stone-900">{data.restaurant.name}</h1>

		{#if data.restaurant.address}
			<p class="mt-1 text-sm text-stone-600">{data.restaurant.address}</p>
		{/if}

		<RestaurantTagsEditor
			restaurantId={data.restaurant.id}
			bind:tags={restaurantTags}
			canEdit={isAuthed}
		/>

		<p class="mt-2 text-sm">
			{#if avgRatingLabel}
				<span class="text-amber-400" aria-hidden="true">★</span>
				<span class="font-medium text-stone-700">{avgRatingLabel}</span>
				<span class="ml-1 text-stone-500">
					({m.review_count_label({
						count: reviews.length,
						more: reviewsMeta.hasNext ? '+' : ''
					})})
				</span>
			{:else}
				<span class="text-stone-400">{m.review_no_ratings_yet()}</span>
			{/if}
		</p>

		{#if affinity && affinity.recommenderCount > 0}
			<p class="mt-3 text-sm font-medium text-emerald-600">
				{m.recommendations_recommenders({ count: affinity.recommenderCount })}
				· {m.recommendations_affinity()}
				{affinity.affinity.toFixed(2)}
			</p>
		{/if}

		{#if data.restaurant.location}
			<p class="mt-2 text-xs text-stone-400">
				{data.restaurant.location.latitude.toFixed(5)},
				{data.restaurant.location.longitude.toFixed(5)}
			</p>
		{/if}

		<p class="mt-2 text-xs text-stone-400">
			<time datetime={data.restaurant.createdAt}>{createdAt}</time>
		</p>
	</div>

	<PhotoGallery restaurantId={data.restaurant.id} initial={data.photos} />

	<section class="mt-8">
		<div class="mb-4 flex items-center justify-between gap-4">
			<h2 class="text-lg font-semibold text-stone-900">{m.restaurant_detail_reviews()}</h2>
			{#if isAuthed && !showForm}
				<button
					type="button"
					onclick={() => (showForm = true)}
					class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
				>
					{myReview ? m.review_edit() : `+ ${m.review_form_title()}`}
				</button>
			{:else if !isAuthed}
				<a
					href={resolve('/auth/login')}
					class="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
				>
					{m.restaurant_detail_signin_to_review()}
				</a>
			{/if}
		</div>

		{#if showForm}
			<div class="mb-6">
				<ReviewForm
					restaurantId={data.restaurant.id}
					existing={myReview}
					oncreated={handleReviewSaved}
					onexisting={handleReviewExisting}
				/>
			</div>
		{/if}

		<ReviewList
			{reviews}
			meta={reviewsMeta}
			loading={loadingMore}
			error={loadMoreError}
			showConnect={isAuthed}
			{currentUserId}
			onloadmore={handleLoadMore}
		/>
	</section>
</main>
