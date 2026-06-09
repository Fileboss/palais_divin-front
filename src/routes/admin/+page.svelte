<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import Header from '$lib/components/Header.svelte';
	import { createInvitation } from '$lib/api/invitations';
	import {
		createTag,
		createTagImplication,
		deleteTag,
		deleteTagImplication,
		listTagCatalog,
		listTagImplications
	} from '$lib/api/tags';
	import {
		TAG_CATEGORIES,
		type CategoryGroup,
		type InvitationResponse,
		type TagCategory,
		type TagImplicationResponse,
		type TagResponse
	} from '$lib/api/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let invitations = $state<InvitationResponse[]>([]);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	let newTagCategory = $state<TagCategory>('REGIME');
	let newTagLabel = $state('');
	let tagSubmitting = $state(false);
	let tagSubmitError = $state<string | null>(null);

	let catalogGroups = $state<CategoryGroup[]>([]);
	let catalogLoading = $state(false);
	let catalogError = $state<string | null>(null);
	let deletingTagId = $state<string | null>(null);
	let deleteError = $state<string | null>(null);

	let implications = $state<TagImplicationResponse[]>([]);
	let implicationsLoading = $state(false);
	let implicationsError = $state<string | null>(null);
	let implicationSourceId = $state<string>('');
	let implicationTargetId = $state<string>('');
	let implicationSubmitting = $state(false);
	let implicationSubmitError = $state<string | null>(null);
	let deletingImplication = $state<string | null>(null);
	let implicationDeleteError = $state<string | null>(null);

	const tagCategories = TAG_CATEGORIES;

	const flatTags = $derived(catalogGroups.flatMap((g) => g.tags));
	const tagsById = $derived(new Map<string, TagResponse>(flatTags.map((t) => [t.id, t])));

	$effect(() => {
		if (catalogGroups.length > 0 || catalogLoading) return;
		catalogLoading = true;
		catalogError = null;
		listTagCatalog(fetch)
			.then((res) => (catalogGroups = res.groups))
			.catch(() => (catalogError = m.admin_tag_catalog_load_failed()))
			.finally(() => (catalogLoading = false));
	});

	$effect(() => {
		if (implications.length > 0 || implicationsLoading) return;
		implicationsLoading = true;
		implicationsError = null;
		listTagImplications(fetch)
			.then((res) => (implications = res.data))
			.catch(() => (implicationsError = m.admin_tag_implications_load_failed()))
			.finally(() => (implicationsLoading = false));
	});

	function tagCategoryLabel(category: TagCategory): string {
		switch (category) {
			case 'REGIME':
				return m.tag_category_regime();
			case 'TYPE':
				return m.tag_category_type();
			case 'SPECIALTY':
				return m.tag_category_specialty();
			case 'VENUE_TYPE':
				return m.tag_category_venue_type();
			case 'SERVICE_AND_PLACE':
				return m.tag_category_service_and_place();
		}
	}

	function tagDisplay(id: string): string {
		const t = tagsById.get(id);
		return t ? t.label : id.slice(0, 8);
	}

	function slugify(input: string): string {
		return input
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	async function handleCreateTag(event: SubmitEvent) {
		event.preventDefault();
		if (tagSubmitting) return;
		const label = newTagLabel.trim();
		const slug = slugify(label);
		if (!label || !slug) return;
		tagSubmitting = true;
		tagSubmitError = null;
		try {
			const created = await createTag(fetch, { category: newTagCategory, label, slug });
			catalogGroups = catalogGroups.map((g) =>
				g.category === created.category ? { ...g, tags: [created, ...g.tags] } : g
			);
			newTagLabel = '';
		} catch {
			tagSubmitError = m.admin_tag_create_failed();
		} finally {
			tagSubmitting = false;
		}
	}

	async function handleDeleteTag(tagId: string, label: string) {
		if (deletingTagId) return;
		if (!confirm(m.admin_tag_delete_confirm({ label }))) return;
		deletingTagId = tagId;
		deleteError = null;
		try {
			await deleteTag(fetch, tagId);
			catalogGroups = catalogGroups.map((g) => ({
				...g,
				tags: g.tags.filter((t) => t.id !== tagId)
			}));
			implications = implications.filter((i) => i.tagId !== tagId && i.impliesTagId !== tagId);
		} catch {
			deleteError = m.admin_tag_delete_failed();
		} finally {
			deletingTagId = null;
		}
	}

	async function handleCreateImplication(event: SubmitEvent) {
		event.preventDefault();
		if (implicationSubmitting) return;
		if (!implicationSourceId || !implicationTargetId) return;
		if (implicationSourceId === implicationTargetId) {
			implicationSubmitError = m.admin_tag_implication_self_invalid();
			return;
		}
		implicationSubmitting = true;
		implicationSubmitError = null;
		try {
			const created = await createTagImplication(fetch, {
				tagId: implicationSourceId,
				impliesTagId: implicationTargetId
			});
			implications = [created, ...implications];
			implicationSourceId = '';
			implicationTargetId = '';
		} catch {
			implicationSubmitError = m.admin_tag_implication_create_failed();
		} finally {
			implicationSubmitting = false;
		}
	}

	async function handleDeleteImplication(tagId: string, impliesTagId: string) {
		const key = `${tagId}:${impliesTagId}`;
		if (deletingImplication) return;
		if (!confirm(m.admin_tag_implication_delete_confirm())) return;
		deletingImplication = key;
		implicationDeleteError = null;
		try {
			await deleteTagImplication(fetch, tagId, impliesTagId);
			implications = implications.filter(
				(i) => !(i.tagId === tagId && i.impliesTagId === impliesTagId)
			);
		} catch {
			implicationDeleteError = m.admin_tag_implication_delete_failed();
		} finally {
			deletingImplication = null;
		}
	}

	const dateFormatter = $derived(
		new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeStyle: 'short' })
	);

	async function handleCreate() {
		if (submitting) return;
		submitting = true;
		submitError = null;
		try {
			const created = await createInvitation(fetch);
			invitations = [created, ...invitations];
		} catch {
			submitError = m.error_invitation_create_failed();
		} finally {
			submitting = false;
		}
	}

	async function copyLink(invitation: InvitationResponse) {
		try {
			await navigator.clipboard.writeText(invitation.signupUrl);
			copiedId = invitation.id;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch {
			// clipboard unavailable; user can still select & copy from the input
		}
	}
</script>

<svelte:head>
	<title>{m.admin_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<h1 class="text-2xl font-bold text-stone-900">{m.admin_title()}</h1>

	<section class="mt-8">
		<h2 class="text-lg font-semibold text-stone-900">{m.admin_section_users()}</h2>

		<div class="mt-4 grid gap-6 md:grid-cols-2">
			<div class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-4">
					<h3 class="text-sm font-semibold text-stone-900">{m.admin_users_invitations()}</h3>
					<button
						type="button"
						onclick={handleCreate}
						disabled={submitting}
						class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? m.admin_invitation_creating() : `+ ${m.admin_invitation_create()}`}
					</button>
				</div>

				{#if submitError}
					<p
						class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
						role="alert"
					>
						{submitError}
					</p>
				{/if}

				{#if invitations.length === 0}
					<p class="mt-3 text-xs text-stone-500">{m.admin_invitation_empty()}</p>
				{:else}
					<ul class="mt-3 flex flex-col gap-2">
						{#each invitations as invitation (invitation.id)}
							<li class="rounded-md border border-stone-200 bg-stone-50 p-3">
								<label class="flex flex-col gap-1">
									<span class="text-[10px] font-medium tracking-wide text-stone-500 uppercase">
										{m.admin_invitation_link_label()}
									</span>
									<div class="flex gap-2">
										<input
											type="text"
											readonly
											value={invitation.signupUrl}
											onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
											class="flex-1 rounded-md border-stone-300 bg-white font-mono text-xs text-stone-800 focus:border-stone-500 focus:ring-stone-500"
										/>
										<button
											type="button"
											onclick={() => copyLink(invitation)}
											class="shrink-0 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
										>
											{copiedId === invitation.id
												? m.admin_invitation_copied()
												: m.admin_invitation_copy()}
										</button>
									</div>
								</label>
								<p class="mt-1.5 text-[11px] text-stone-500">
									{m.admin_invitation_expires_at({
										date: dateFormatter.format(new Date(invitation.expiresAt))
									})}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<h3 class="text-sm font-semibold text-stone-900">{m.admin_users_block()}</h3>
				<div class="mt-4 flex flex-col items-start gap-1">
					<button
						type="button"
						disabled
						class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
					>
						{m.admin_users_block()}
					</button>
					<span class="text-[11px] text-stone-500">{m.admin_users_block_caption()}</span>
				</div>
			</div>
		</div>
	</section>

	<section class="mt-8">
		<h2 class="text-lg font-semibold text-stone-900">{m.admin_section_tags()}</h2>

		<div class="mt-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h3 class="text-sm font-semibold text-stone-900">{m.admin_tag_create()}</h3>

			<form onsubmit={handleCreateTag} class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-medium text-stone-700">{m.admin_tag_category()}</span>
					<select
						bind:value={newTagCategory}
						disabled={tagSubmitting}
						class="rounded-md border-stone-300 text-sm focus:border-stone-500 focus:ring-stone-500 disabled:opacity-50"
					>
						{#each tagCategories as cat (cat)}
							<option value={cat}>{tagCategoryLabel(cat)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-medium text-stone-700">{m.admin_tag_label()}</span>
					<input
						type="text"
						bind:value={newTagLabel}
						required
						minlength="1"
						maxlength="127"
						disabled={tagSubmitting}
						class="rounded-md border-stone-300 text-sm focus:border-stone-500 focus:ring-stone-500 disabled:opacity-50"
					/>
				</label>

				<button
					type="submit"
					disabled={tagSubmitting || newTagLabel.trim().length === 0}
					class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{tagSubmitting ? m.admin_tag_creating() : `+ ${m.admin_tag_create()}`}
				</button>
			</form>

			{#if tagSubmitError}
				<p
					class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
					role="alert"
				>
					{tagSubmitError}
				</p>
			{/if}
		</div>

		<div class="mt-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h3 class="text-sm font-semibold text-stone-900">{m.admin_tag_catalog()}</h3>

			{#if catalogLoading}
				<p class="mt-3 text-xs text-stone-500">{m.tag_picker_loading()}</p>
			{:else if catalogError}
				<p
					class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
					role="alert"
				>
					{catalogError}
				</p>
			{:else}
				{#if deleteError}
					<p
						class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
						role="alert"
					>
						{deleteError}
					</p>
				{/if}

				<div class="mt-3 flex flex-col gap-4">
					{#each catalogGroups as group (group.category)}
						<div class="flex flex-col gap-1.5">
							<p class="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
								{tagCategoryLabel(group.category)}
							</p>
							{#if group.tags.length === 0}
								<p class="text-xs text-stone-400">{m.admin_tag_catalog_category_empty()}</p>
							{:else}
								<ul class="flex flex-wrap gap-1.5">
									{#each group.tags as tag (tag.id)}
										<li
											class="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-stone-700"
										>
											<span>{tag.label}</span>
											<button
												type="button"
												onclick={() => handleDeleteTag(tag.id, tag.label)}
												disabled={deletingTagId !== null}
												aria-label={m.admin_tag_delete_aria({ label: tag.label })}
												class="flex size-4 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
											>
												{deletingTagId === tag.id ? '…' : '×'}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="mt-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h3 class="text-sm font-semibold text-stone-900">{m.admin_tag_implications()}</h3>
			<p class="mt-1 text-xs text-stone-500">{m.admin_tag_implications_caption()}</p>

			<form
				onsubmit={handleCreateImplication}
				class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
			>
				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-medium text-stone-700">{m.admin_tag_implication_source()}</span>
					<select
						bind:value={implicationSourceId}
						disabled={implicationSubmitting || catalogLoading || flatTags.length === 0}
						required
						class="rounded-md border-stone-300 text-sm focus:border-stone-500 focus:ring-stone-500 disabled:opacity-50"
					>
						<option value="" disabled>—</option>
						{#each catalogGroups as group (group.category)}
							{#if group.tags.length > 0}
								<optgroup label={tagCategoryLabel(group.category)}>
									{#each group.tags as tag (tag.id)}
										<option value={tag.id}>{tag.label}</option>
									{/each}
								</optgroup>
							{/if}
						{/each}
					</select>
				</label>

				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-medium text-stone-700">{m.admin_tag_implication_target()}</span>
					<select
						bind:value={implicationTargetId}
						disabled={implicationSubmitting || catalogLoading || flatTags.length === 0}
						required
						class="rounded-md border-stone-300 text-sm focus:border-stone-500 focus:ring-stone-500 disabled:opacity-50"
					>
						<option value="" disabled>—</option>
						{#each catalogGroups as group (group.category)}
							{#if group.tags.length > 0}
								<optgroup label={tagCategoryLabel(group.category)}>
									{#each group.tags as tag (tag.id)}
										<option value={tag.id}>{tag.label}</option>
									{/each}
								</optgroup>
							{/if}
						{/each}
					</select>
				</label>

				<button
					type="submit"
					disabled={implicationSubmitting ||
						!implicationSourceId ||
						!implicationTargetId ||
						implicationSourceId === implicationTargetId}
					class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{implicationSubmitting
						? m.admin_tag_implication_creating()
						: `+ ${m.admin_tag_implication_add()}`}
				</button>
			</form>

			{#if implicationSubmitError}
				<p
					class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
					role="alert"
				>
					{implicationSubmitError}
				</p>
			{/if}

			{#if implicationDeleteError}
				<p
					class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
					role="alert"
				>
					{implicationDeleteError}
				</p>
			{/if}

			<div class="mt-4">
				{#if implicationsLoading}
					<p class="text-xs text-stone-500">{m.tag_picker_loading()}</p>
				{:else if implicationsError}
					<p
						class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
						role="alert"
					>
						{implicationsError}
					</p>
				{:else if implications.length === 0}
					<p class="text-xs text-stone-400">{m.admin_tag_implications_empty()}</p>
				{:else}
					<ul class="flex flex-col gap-1.5">
						{#each implications as imp (`${imp.tagId}:${imp.impliesTagId}`)}
							{@const key = `${imp.tagId}:${imp.impliesTagId}`}
							<li
								class="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
							>
								<span class="font-medium">
									{tagDisplay(imp.tagId)}
									<span class="mx-1 text-stone-400" aria-hidden="true">→</span>
									{tagDisplay(imp.impliesTagId)}
								</span>
								<button
									type="button"
									onclick={() => handleDeleteImplication(imp.tagId, imp.impliesTagId)}
									disabled={deletingImplication !== null}
									aria-label={m.admin_tag_implication_delete_aria()}
									class="flex size-5 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{deletingImplication === key ? '…' : '×'}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</section>
</main>
