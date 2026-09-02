<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import { listAuthorReviewsPublic } from '$lib/api/users';
	import { listMyFollowing, unfollow } from '$lib/api/connections';
	import type { AuthorReviewResponse, FollowingResponse, PageMeta } from '$lib/api/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let reviews = $state<AuthorReviewResponse[]>(data.reviews);
	// svelte-ignore state_referenced_locally
	let reviewsMeta = $state<PageMeta>(data.reviewsMeta);
	let loadingMoreReviews = $state(false);
	let reviewsError = $state<string | null>(null);

	// svelte-ignore state_referenced_locally
	let following = $state<FollowingResponse[]>(data.following ?? []);
	// svelte-ignore state_referenced_locally
	let followingMeta = $state<PageMeta | null>(data.followingMeta);
	let loadingMoreFollowing = $state(false);
	let followingError = $state<string | null>(null);
	const unfollowingIds = new SvelteSet<string>();

	const memberSince = $derived(
		new Date(data.profile.createdAt).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	const initial = $derived(data.profile.displayName.trim().charAt(0).toUpperCase() || '?');
	const showFollowButton = $derived(!data.isOwnProfile && !!data.user);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function followingInitial(name: string): string {
		return name.trim().charAt(0).toUpperCase() || '?';
	}

	async function handleLoadMoreReviews() {
		if (!reviewsMeta.hasNext || !reviewsMeta.nextCursor || loadingMoreReviews) return;
		loadingMoreReviews = true;
		reviewsError = null;
		try {
			const next = await listAuthorReviewsPublic(fetch, data.profile.id, {
				cursor: reviewsMeta.nextCursor,
				size: reviewsMeta.size
			});
			reviews = [...reviews, ...next.data];
			reviewsMeta = next.page;
		} catch {
			reviewsError = m.error_load_more_failed();
		} finally {
			loadingMoreReviews = false;
		}
	}

	async function handleLoadMoreFollowing() {
		if (!followingMeta?.hasNext || !followingMeta.nextCursor || loadingMoreFollowing) return;
		loadingMoreFollowing = true;
		followingError = null;
		try {
			const next = await listMyFollowing(fetch, {
				cursor: followingMeta.nextCursor,
				size: followingMeta.size
			});
			following = [...following, ...next.data];
			followingMeta = next.page;
		} catch {
			followingError = m.error_load_more_failed();
		} finally {
			loadingMoreFollowing = false;
		}
	}

	async function handleUnfollow(userId: string) {
		if (unfollowingIds.has(userId)) return;
		unfollowingIds.add(userId);
		followingError = null;
		try {
			await unfollow(fetch, userId);
			following = following.filter((entry) => entry.user.id !== userId);
		} catch {
			followingError = m.error_unfollow_failed();
		} finally {
			unfollowingIds.delete(userId);
		}
	}
</script>

<svelte:head>
	<title>{data.profile.displayName} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-3xl px-4 py-8">
	<section class="mb-8 flex items-center justify-between gap-4">
		<div class="flex items-center gap-4">
			<div
				aria-hidden="true"
				class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-2xl font-semibold text-stone-600"
			>
				{initial}
			</div>
			<div class="flex flex-col">
				<h1 class="font-display text-2xl text-stone-900">{data.profile.displayName}</h1>
				<p class="text-sm text-stone-500">
					{m.profile_member_since({ date: memberSince })}
				</p>
			</div>
		</div>
		{#if showFollowButton}
			<FollowButton
				targetId={data.profile.id}
				initialFollowed={data.profile.isFollowedByMe ?? false}
			/>
		{/if}
	</section>

	{#if data.isOwnProfile}
		<section class="mb-8">
			<h2 class="mb-3 text-sm font-medium tracking-wide text-stone-500 uppercase">
				{m.profile_following_title()}
			</h2>
			{#if following.length === 0}
				<p
					class="rounded-md border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500"
				>
					{m.profile_following_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each following as entry (entry.user.id)}
						<li
							class="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
						>
							<a
								href={resolve(`/users/${entry.user.id}`)}
								class="flex items-center gap-3 text-sm font-medium text-stone-800 hover:text-stone-900"
							>
								<span
									aria-hidden="true"
									class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-stone-600"
								>
									{followingInitial(entry.user.displayName)}
								</span>
								<span>{entry.user.displayName}</span>
							</a>
							<button
								type="button"
								onclick={() => handleUnfollow(entry.user.id)}
								disabled={unfollowingIds.has(entry.user.id)}
								class="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{unfollowingIds.has(entry.user.id) ? m.follow_unfollowing() : m.follow_unfollow()}
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if followingError}
				<p class="mt-3 text-sm text-red-600" role="alert">{followingError}</p>
			{/if}

			{#if followingMeta?.hasNext}
				<div class="mt-4 flex justify-center">
					<button
						type="button"
						onclick={handleLoadMoreFollowing}
						disabled={loadingMoreFollowing}
						class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loadingMoreFollowing ? m.restaurant_loading() : m.restaurant_load_more()}
					</button>
				</div>
			{/if}
		</section>
	{/if}

	<h2 class="mb-3 text-sm font-medium tracking-wide text-stone-500 uppercase">
		{m.restaurant_detail_reviews()}
	</h2>

	{#if reviews.length === 0 && !reviewsMeta.hasNext}
		<p
			class="rounded-md border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500"
		>
			{m.review_list_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each reviews as review (review.reviewId)}
				<li class="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div class="flex flex-col gap-0.5">
							<a
								href={resolve(`/restaurants/${review.restaurant.id}`)}
								class="text-base font-semibold text-stone-900 underline-offset-4 hover:underline"
							>
								{review.restaurant.name}
							</a>
							<p class="text-sm text-stone-500">{review.restaurant.address}</p>
						</div>
						<div class="flex flex-col items-end gap-1">
							<span class="text-sm text-amber-400" aria-label="{review.rating} / 5">
								{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
							</span>
							<time datetime={review.createdAt} class="text-xs text-stone-400">
								{formatDate(review.createdAt)}
							</time>
						</div>
					</div>
					{#if review.comment}
						<p class="text-sm whitespace-pre-line text-stone-700">{review.comment}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if reviewsError}
		<p class="mt-4 text-sm text-red-600" role="alert">{reviewsError}</p>
	{/if}

	{#if reviewsMeta.hasNext}
		<div class="mt-6 flex justify-center">
			<button
				type="button"
				onclick={handleLoadMoreReviews}
				disabled={loadingMoreReviews}
				class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loadingMoreReviews ? m.restaurant_loading() : m.restaurant_load_more()}
			</button>
		</div>
	{/if}
</main>
