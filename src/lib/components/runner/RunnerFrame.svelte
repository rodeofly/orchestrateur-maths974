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
		onready?: (p: unknown) => void;
		onattempt?: (p: unknown) => void;
		onprogress?: (p: unknown) => void;
		onexit?: (p: unknown) => void;
	} = $props();

	let container = $state<HTMLDivElement>();
	let activity: { on: Function; command: Function; destroy: Function } | null = null;

	onMount(() => {
		activity = mount(container, { url, params, allowOrigin, title });
		if (onready) activity.on('ready', onready);
		if (onattempt) activity.on('attempt', onattempt);
		if (onprogress) activity.on('progress', onprogress);
		if (onexit) activity.on('exit', onexit);
	});
	onDestroy(() => activity?.destroy());

	// Commande l'activité depuis le parent : command('pause'|'resume'|'reset'|'timeup').
	export function command(action: string, extra?: Record<string, unknown>) {
		activity?.command(action, extra);
	}
</script>

<div class="runner" bind:this={container} style="height: {height}"></div>

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
	/* L'iframe injectée par le host remplit le conteneur. */
	.runner :global(iframe) {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}
</style>
