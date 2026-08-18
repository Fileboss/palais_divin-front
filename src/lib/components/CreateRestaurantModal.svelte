<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { createRestaurant } from '$lib/api/restaurants';
	import { attachRestaurantTag } from '$lib/api/tags';
	import { uploadAndRegisterPhoto } from '$lib/photos';
	import TagPicker from './TagPicker.svelte';
	import type { PhotoResponse, RestaurantResponse } from '$lib/api/types';

	const MAX_FILES = 5;
	const MAX_BYTES = 10 * 1024 * 1024;

	let {
		open = $bindable(false),
		oncreated
	}: {
		open?: boolean;
		oncreated: (restaurant: RestaurantResponse, photos: PhotoResponse[]) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	let name = $state('');
	let address = $state('');
	let selectedTagIds = $state<string[]>([]);
	let files = $state<File[]>([]);
	let fileValidationError = $state<string | null>(null);

	type Phase =
		| { kind: 'idle' }
		| { kind: 'creating' }
		| { kind: 'uploading'; done: number; total: number }
		| {
				kind: 'partial';
				restaurant: RestaurantResponse;
				photos: PhotoResponse[];
				failed: string[];
				failedTagCount: number;
		  };

	let phase = $state<Phase>({ kind: 'idle' });
	let submitError = $state<string | null>(null);

	const submitting = $derived(phase.kind === 'creating' || phase.kind === 'uploading');

	const previews = $derived(files.map((file) => ({ file, url: URL.createObjectURL(file) })));

	$effect(() => {
		const urls = previews.map((p) => p.url);
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
		};
	});

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
		selectedTagIds = [];
		files = [];
		fileValidationError = null;
		submitError = null;
		phase = { kind: 'idle' };
	}

	function close() {
		open = false;
		reset();
	}

	function handleFilesPicked(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files ? Array.from(input.files) : [];
		fileValidationError = null;

		if (picked.length + files.length > MAX_FILES) {
			fileValidationError = m.photo_too_many();
			input.value = '';
			return;
		}
		for (const f of picked) {
			if (!f.type.startsWith('image/')) {
				fileValidationError = m.photo_bad_type({ name: f.name });
				input.value = '';
				return;
			}
			if (f.size > MAX_BYTES) {
				fileValidationError = m.photo_too_large({ name: f.name });
				input.value = '';
				return;
			}
		}
		files = [...files, ...picked];
		input.value = '';
	}

	function removeFile(index: number) {
		files = files.filter((_, i) => i !== index);
		fileValidationError = null;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitError = null;
		phase = { kind: 'creating' };

		let restaurant: RestaurantResponse;
		try {
			restaurant = await createRestaurant(fetch, { name: name.trim(), address: address.trim() });
		} catch {
			submitError = m.error_create_failed();
			phase = { kind: 'idle' };
			return;
		}

		let failedTagCount = 0;
		for (const tagId of selectedTagIds) {
			try {
				await attachRestaurantTag(fetch, restaurant.id, tagId);
			} catch {
				failedTagCount += 1;
			}
		}

		if (files.length === 0) {
			if (failedTagCount === 0) {
				oncreated(restaurant, []);
				close();
			} else {
				phase = { kind: 'partial', restaurant, photos: [], failed: [], failedTagCount };
			}
			return;
		}

		const total = files.length;
		const uploaded: PhotoResponse[] = [];
		const failed: string[] = [];
		phase = { kind: 'uploading', done: 0, total };

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const scopeKey = `photo:${restaurant.id}:${i}:${file.name}:${file.size}`;
			try {
				const photo = await uploadAndRegisterPhoto(fetch, restaurant.id, file, scopeKey);
				uploaded.push(photo);
			} catch {
				failed.push(file.name);
			}
			phase = { kind: 'uploading', done: i + 1, total };
		}

		if (failed.length === 0 && failedTagCount === 0) {
			oncreated(restaurant, uploaded);
			close();
		} else {
			phase = { kind: 'partial', restaurant, photos: uploaded, failed, failedTagCount };
		}
	}

	function continueAnyway() {
		if (phase.kind !== 'partial') return;
		oncreated(phase.restaurant, phase.photos);
		close();
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
				maxlength="500"
				class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
			/>
		</label>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-medium text-stone-700">{m.tag_picker_label()}</span>
			<TagPicker bind:selected={selectedTagIds} disabled={submitting} />
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-medium text-stone-700">{m.photo_add_label()}</span>
			<input
				type="file"
				accept="image/*"
				multiple
				onchange={handleFilesPicked}
				disabled={submitting || files.length >= MAX_FILES}
				class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200 disabled:opacity-50"
			/>
			<p class="text-xs text-stone-500">{m.photo_select_hint()}</p>
			{#if fileValidationError}
				<p class="text-xs text-red-600" role="alert">{fileValidationError}</p>
			{/if}
			{#if previews.length > 0}
				<ul class="flex flex-wrap gap-2">
					{#each previews as preview, i (preview.url)}
						<li class="relative">
							<img
								src={preview.url}
								alt=""
								class="size-16 rounded border border-stone-200 object-cover"
							/>
							<button
								type="button"
								onclick={() => removeFile(i)}
								disabled={submitting}
								aria-label={m.photo_remove_aria({ name: preview.file.name })}
								class="absolute -top-1.5 -right-1.5 rounded-full bg-stone-900 px-1.5 text-xs text-white shadow-sm hover:bg-stone-700 disabled:opacity-50"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if submitError}
			<p class="text-sm text-red-600" role="alert">{submitError}</p>
		{/if}

		{#if phase.kind === 'uploading'}
			<p class="text-sm text-stone-600" role="status">
				{m.photo_uploading_progress({ done: phase.done, total: phase.total })}
			</p>
		{/if}

		{#if phase.kind === 'partial'}
			<div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" role="alert">
				{#if phase.failed.length > 0}
					<p class="font-medium text-amber-900">{m.photo_upload_partial_title()}</p>
					<ul class="mt-1 list-disc pl-5 text-amber-800">
						{#each phase.failed as name (name)}
							<li>{m.photo_upload_failed_one({ name })}</li>
						{/each}
					</ul>
				{/if}
				{#if phase.failedTagCount > 0}
					<p
						class="text-amber-800"
						class:mt-2={phase.failed.length > 0}
						class:font-medium={phase.failed.length === 0}
					>
						{m.tag_attach_partial({ count: phase.failedTagCount })}
					</p>
				{/if}
			</div>
		{/if}

		<footer class="flex justify-end gap-2 pt-2">
			{#if phase.kind === 'partial'}
				<button
					type="button"
					onclick={continueAnyway}
					class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
				>
					{m.photo_upload_partial_continue()}
				</button>
			{:else}
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
			{/if}
		</footer>
	</form>
</dialog>
