<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { connect } from '$lib/api/connections';
	import { ApiError } from '$lib/api/types';

	let { targetId }: { targetId: string } = $props();

	let status = $state<'idle' | 'adding' | 'added'>('idle');
	let error = $state<string | null>(null);

	async function handleConnect() {
		if (status !== 'idle') return;
		status = 'adding';
		error = null;
		try {
			await connect(fetch, targetId);
			status = 'added';
		} catch (err) {
			if (err instanceof ApiError && err.status === 422) {
				// self-connection — hide the button
				status = 'added';
			} else {
				error = m.error_connect_failed();
				status = 'idle';
			}
		}
	}
</script>

{#if status === 'added'}
	<span class="text-xs font-medium text-stone-400">{m.connect_added()}</span>
{:else}
	<button
		type="button"
		onclick={handleConnect}
		disabled={status === 'adding'}
		class="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{status === 'adding' ? m.connect_adding() : m.connect_add()}
	</button>
	{#if error}
		<span class="text-xs text-red-500">{error}</span>
	{/if}
{/if}
