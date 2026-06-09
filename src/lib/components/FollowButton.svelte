<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { follow, unfollow } from '$lib/api/connections';
	import { ApiError } from '$lib/api/types';

	let { targetId, initialFollowed = false }: { targetId: string; initialFollowed?: boolean } =
		$props();

	type Status = 'idle' | 'following' | 'followed' | 'unfollowing';

	// svelte-ignore state_referenced_locally
	let status = $state<Status>(initialFollowed ? 'followed' : 'idle');
	let error = $state<string | null>(null);

	async function handleClick() {
		if (status === 'following' || status === 'unfollowing') return;
		error = null;
		if (status === 'idle') {
			status = 'following';
			try {
				await follow(fetch, targetId);
				status = 'followed';
			} catch (err) {
				if (err instanceof ApiError && err.status === 422) {
					status = 'followed';
				} else {
					error = m.error_follow_failed();
					status = 'idle';
				}
			}
		} else {
			status = 'unfollowing';
			try {
				await unfollow(fetch, targetId);
				status = 'idle';
			} catch {
				error = m.error_unfollow_failed();
				status = 'followed';
			}
		}
	}

	const label = $derived(
		status === 'following'
			? m.follow_pending()
			: status === 'unfollowing'
				? m.follow_unfollowing()
				: status === 'followed'
					? m.follow_following()
					: m.follow_action()
	);
</script>

<div class="inline-flex items-center gap-2">
	<button
		type="button"
		onclick={handleClick}
		disabled={status === 'following' || status === 'unfollowing'}
		class="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{label}
	</button>
	{#if error}
		<span class="text-xs text-red-500" role="alert">{error}</span>
	{/if}
</div>
