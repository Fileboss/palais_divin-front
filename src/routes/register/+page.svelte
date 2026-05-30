<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { signup, problemTypeSuffix } from '$lib/api/signup';
	import { ApiError, type ProblemFieldError } from '$lib/api/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let displayName = $state('');
	let password = $state('');

	let submitting = $state(false);
	let succeeded = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function mapError(err: unknown): { message: string; fields: Record<string, string> } {
		if (!(err instanceof ApiError)) {
			return { message: m.register_error_generic(), fields: {} };
		}
		const suffix = problemTypeSuffix(err.problem?.type);

		if (err.status === 400 && suffix === 'validation') {
			const fields: Record<string, string> = {};
			for (const fe of (err.problem?.errors ?? []) as ProblemFieldError[]) {
				if (fe.field) fields[fe.field] = fe.message;
			}
			return { message: '', fields };
		}
		if (err.status === 404 || suffix === 'not-found') {
			return { message: m.register_error_invalid_token(), fields: {} };
		}
		if (err.status === 409 || suffix === 'conflict') {
			return { message: m.register_error_email_taken(), fields: {} };
		}
		if (err.status === 410 || suffix === 'invitation-not-usable') {
			const reason = err.problem?.reason;
			if (reason === 'EXPIRED') return { message: m.register_error_expired(), fields: {} };
			if (reason === 'ALREADY_CONSUMED')
				return { message: m.register_error_already_used(), fields: {} };
			return { message: m.register_error_invalid_token(), fields: {} };
		}
		if (err.status === 502 || suffix === 'upstream-failure') {
			return { message: m.register_error_idp_down(), fields: {} };
		}
		return { message: m.register_error_generic(), fields: {} };
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		formError = null;
		fieldErrors = {};
		try {
			await signup(fetch, {
				token: data.token,
				email: email.trim(),
				displayName: displayName.trim(),
				password
			});
			succeeded = true;
		} catch (err) {
			const mapped = mapError(err);
			formError = mapped.message || null;
			fieldErrors = mapped.fields;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{m.register_title()} · {m.brand_name()}</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
	<div class="mb-8 text-center">
		<a href={resolve('/')} class="text-lg font-semibold tracking-tight text-stone-900">
			{m.brand_name()} 🦩
		</a>
	</div>

	<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
		{#if succeeded}
			<h1 class="text-xl font-semibold text-stone-900">{m.register_success_title()}</h1>
			<p class="mt-2 text-sm text-stone-600">{m.register_success_body()}</p>
			<a
				href={resolve('/auth/login')}
				class="mt-6 inline-flex items-center justify-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
			>
				{m.register_success_signin()} →
			</a>
		{:else}
			<h1 class="text-xl font-semibold text-stone-900">{m.register_title()}</h1>
			<p class="mt-1 text-sm text-stone-600">{m.register_subtitle()}</p>

			<form onsubmit={handleSubmit} class="mt-6 flex flex-col gap-4">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-stone-700">{m.register_field_email()}</span>
					<input
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
						aria-invalid={fieldErrors.email ? 'true' : undefined}
					/>
					{#if fieldErrors.email}
						<span class="text-xs text-red-600" role="alert">{fieldErrors.email}</span>
					{/if}
				</label>

				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-stone-700">{m.register_field_display_name()}</span>
					<input
						type="text"
						bind:value={displayName}
						required
						minlength="1"
						autocomplete="name"
						class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
						aria-invalid={fieldErrors.displayName ? 'true' : undefined}
					/>
					{#if fieldErrors.displayName}
						<span class="text-xs text-red-600" role="alert">{fieldErrors.displayName}</span>
					{/if}
				</label>

				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-stone-700">{m.register_field_password()}</span>
					<input
						type="password"
						bind:value={password}
						required
						minlength="1"
						autocomplete="new-password"
						class="rounded-md border-stone-300 focus:border-stone-500 focus:ring-stone-500"
						aria-invalid={fieldErrors.password ? 'true' : undefined}
					/>
					{#if fieldErrors.password}
						<span class="text-xs text-red-600" role="alert">{fieldErrors.password}</span>
					{/if}
				</label>

				{#if formError}
					<p
						class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
						role="alert"
					>
						{formError}
					</p>
				{/if}

				<button
					type="submit"
					disabled={submitting}
					class="mt-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? m.register_submitting() : m.register_submit()}
				</button>
			</form>
		{/if}
	</div>
</main>
