<script lang="ts">
	// Embarque une activité via le connecteur @maths974/embed (host vendoré).
	// Émet ses événements (ready/attempt/progress/exit) vers le parent.
	import { onMount, onDestroy } from 'svelte';
	import { mount } from '$m974/host.js';

	let {
		url,
		params = {},
		allowOrigin = '*',
		title = 'activité',
		height = '80vh',
		mode = 'iframe',
		adapter,
		referrerPolicy,
		onready,
		onattempt,
		onprogress,
		onexit
	}: {
		url: string;
		params?: Record<string, unknown>;
		allowOrigin?: string | string[];
		title?: string;
		height?: string;
		/** 'iframe' (défaut) embarque l'app. 'newtab' : app NON embarquable (ex. coopmaths
		 *  derrière Cloudflare, qui boucle son challenge en iframe) → on l'ouvre dans un
		 *  onglet (navigation top-level), sans iframe ni capture. */
		mode?: 'iframe' | 'newtab';
		/** Adaptateur « bridged » (Tier 2) : traduit le protocole d'une app tierce en
		 *  AttemptResult, relayé via onattempt. Cf. $lib/activities/bridges. */
		adapter?: (data: unknown, origin: string) => unknown;
		/** Politique de Referer de l'iframe. Par défaut no-referrer (RGPD) ; pour une app
		 *  bridgée on livre l'origine seule (certains serveurs refusent le no-referer). */
		referrerPolicy?: ReferrerPolicy;
		onready?: (p: unknown) => void;
		onattempt?: (p: unknown) => void;
		onprogress?: (p: unknown) => void;
		onexit?: (p: unknown) => void;
	} = $props();

	let container = $state<HTMLDivElement>();
	let activity: { on: Function; command: Function; destroy: Function } | null = null;

	onMount(() => {
		if (mode === 'newtab') return; // pas d'iframe : on n'embarque pas (cf. mode)
		// App bridgée (adapter présent) sans politique explicite → on livre l'origine
		// seule, pour les serveurs tiers qui refusent une requête sans Referer (ex. coopmaths).
		const refPol = referrerPolicy ?? (adapter ? 'strict-origin-when-cross-origin' : undefined);
		activity = mount(container, { url, params, allowOrigin, title, adapter, referrerPolicy: refPol });
		if (onready) activity.on('ready', onready);
		if (onattempt) activity.on('attempt', onattempt);
		if (onprogress) activity.on('progress', onprogress);
		if (onexit) activity.on('exit', onexit);
	});
	onDestroy(() => activity?.destroy());

	function openNewTab() {
		// noopener,noreferrer : pas de fuite d'origine/contexte vers l'app externe.
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	// Commande l'activité depuis le parent : command('pause'|'resume'|'reset'|'timeup').
	export function command(action: string, extra?: Record<string, unknown>) {
		activity?.command(action, extra);
	}
</script>

{#if mode === 'newtab'}
	<div class="runner external" style="height: {height}">
		<div class="launch">
			<p class="lead">Cette activité s'ouvre dans un <strong>nouvel onglet</strong>.</p>
			<button class="open" onclick={openNewTab}>Ouvrir {title} ↗</button>
			<p class="note">App externe (non embarquable) — la réussite n'est pas captée automatiquement.</p>
		</div>
	</div>
{:else}
	<div class="runner" bind:this={container} style="height: {height}"></div>
{/if}

<style>
	/* Hauteur DÉFINIE (pas seulement min-height) : sinon l'iframe height:100%
	   s'effondre et l'activité embarquée se retrouve écrasée. */
	.runner {
		width: 100%;
		min-height: 420px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--surface);
	}
	.runner.external {
		display: grid;
		place-items: center;
		text-align: center;
		padding: var(--space-6);
	}
	.launch {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
	}
	.launch .lead {
		font-size: 1.05rem;
	}
	.launch .open {
		font-weight: 700;
		font-size: 1.05rem;
		padding: 0.7rem 1.3rem;
		border: 1px solid var(--role-accent);
		background: var(--role-accent-soft);
		color: var(--role-accent);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.launch .open:hover {
		filter: brightness(0.97);
	}
	.launch .note {
		font-size: 0.82rem;
		color: var(--text-muted);
		max-width: 28rem;
	}
	/* L'iframe injectée par le host remplit le conteneur. */
	.runner :global(iframe) {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}
</style>
