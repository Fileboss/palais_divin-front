<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { createRestaurant } from '$lib/api/restaurants';
	import type { RestaurantResponse } from '$lib/api/types';

	let {
		open = $bindable(false),
		oncreated
	}: {
		open?: boolean;
		oncreated: (restaurant: RestaurantResponse) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	let name = $state('');
	let address = $state('');

	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function reset() {
		name = '';
		address = '';
		submitError = null;
		submitting = false;
	}

	function close() {
		open = false;
		reset();
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		submitError = null;
		try {
			const created = await createRestaurant(fetch, {
				name: name.trim(),
				address: address.trim()
			});
			oncreated(created);
			close();
		} catch {
			submitError = m.error_create_failed();
			submitting = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	class="m-auto w-full max-w-md rounded-lg bg-white p-0 shadow-xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm"
>
	<form onsubmit={handleSubmit} class="flex flex-col gap-4 p-6">
		<header class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-stone-900">{m.create_restaurant_title()}</h2>
			<button
				type="button"
				onclick={close}
				aria-label={m.form_cancel()}
				class="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
			>
				<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true">
					<path
						d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
					/>
				</svg>
			</button>
		</header>

		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium text-stone-700">{m.form_name()}</span>
			<input
				type="text"
				bind:value={name}
				required
				minlength="1"
				maxlength="200"
				class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
			/>
		</label>

		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium text-stone-700">{m.form_address()}</span>
			<input
				type="text"
				bind:value={address}
				required
				minlength="1"
				class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
			/>
		</label>

		{#if submitError}
			<p class="text-sm text-red-600" role="alert">{submitError}</p>
		{/if}

		<footer class="flex justify-end gap-2 pt-2">
			<button
				type="button"
				onclick={close}
				disabled={submitting}
				class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
			>
				{m.form_cancel()}
			</button>
			<button
				type="submit"
				disabled={submitting}
				class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? m.form_submitting() : m.form_submit()}
			</button>
		</footer>
	</form>
</dialog>
