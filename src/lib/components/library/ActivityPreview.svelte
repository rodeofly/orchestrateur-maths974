<script lang="ts">
	// Aperçu d'une activité depuis la bibliothèque : métadonnées + l'activité qui TOURNE
	// (embarquée pour les apps natives, bouton « Ouvrir ↗ » pour les externes). Lecture
	// seule (pas d'enregistrement) — c'est un coup d'œil prof, pas une session élève.
	import RunnerFrame from '$components/runner/RunnerFrame.svelte';
	import { activityUrl, type Activity } from '$lib/activities/catalog';
	import { getRituel, type RituelType } from '$lib/activities/rituels';
	import type { Comp } from '$lib/activities/types';

	let { activity, onclose }: { activity: Activity; onclose: () => void } = $props();

	const COMP: Record<Comp, string> = {
		ch: 'chercher', mo: 'modéliser', re: 'représenter', ra: 'raisonner', ca: 'calculer', co: 'communiquer'
	};
	let running = $state(false); // on ne monte l'iframe qu'à la demande (évite de charger pour rien)
	const external = $derived(activity.embed.mode === 'newtab');
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="panel" role="dialog" aria-label="Aperçu de l'activité">
	<header>
		<span class="ttl">{activity.emoji ?? '📄'} {activity.label}</span>
		<button class="x" onclick={onclose} aria-label="Fermer">✕</button>
	</header>

	{#if activity.description}<p class="desc">{activity.description}</p>{/if}

	<dl class="meta">
		<div><dt>Domaine</dt><dd>{activity.taxo.domaineLabel ?? activity.taxo.domaineKey}{#if activity.taxo.sousTheme} · {activity.taxo.sousTheme}{/if}</dd></div>
		{#if activity.taxo.gs?.length}<div><dt>Étiquettes GS</dt><dd class="gsrow">{#each activity.taxo.gs as g (g)}<span class="gs">{g}</span>{/each}</dd></div>{/if}
		{#if activity.competences?.length}<div><dt>Compétences</dt><dd>{activity.competences.map((c) => COMP[c]).join(', ')}</dd></div>{/if}
		{#if activity.rituels?.length}<div><dt>Rituels</dt><dd>{#each activity.rituels as r (r)}<span class="rit">{getRituel(r as RituelType).emoji} {getRituel(r as RituelType).label}</span>{/each}</dd></div>{/if}
		<div><dt>Source</dt><dd>{activity.source}{#if external} · <span class="ext">externe (nouvel onglet)</span>{/if}</dd></div>
	</dl>

	<div class="preview">
		{#if external}
			<RunnerFrame url={activityUrl(activity)} title={activity.label} height="46vh" mode="newtab" />
		{:else if running}
			<RunnerFrame url={activityUrl(activity)} params={{ kind: activity.kind }} allowOrigin="*" title={activity.label} height="46vh" />
		{:else}
			<button class="run" onclick={() => (running = true)}>▶ Lancer l'aperçu</button>
		{/if}
	</div>
</div>

<style>
	.backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: var(--z-modal); }
	.panel { position: fixed; z-index: var(--z-modal); top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(46rem, 95vw); max-height: 90vh; overflow: auto; display: flex; flex-direction: column; gap: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: var(--space-4); }
	header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
	.ttl { font-weight: 700; font-size: 1.1rem; }
	.x { border: none; background: none; cursor: pointer; font-size: 1.1rem; color: var(--text-muted); }
	.desc { color: var(--text-muted); margin: 0; }
	.meta { display: grid; gap: var(--space-2); margin: 0; }
	.meta div { display: grid; grid-template-columns: 8rem 1fr; gap: var(--space-2); align-items: baseline; }
	.meta dt { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
	.meta dd { margin: 0; font-size: 0.9rem; }
	.gsrow { display: flex; gap: 0.3rem; flex-wrap: wrap; }
	.gs { font-size: 0.7rem; font-weight: 700; background: var(--gray-900); color: #fff; padding: 0.1rem 0.45rem; border-radius: var(--radius-full); }
	.rit { display: inline-block; margin-right: 0.5rem; }
	.ext { color: var(--role-accent); font-weight: 600; }
	.preview { display: grid; place-items: center; min-height: 6rem; }
	.run { font-weight: 700; font-size: 1rem; padding: 0.7rem 1.3rem; border: 1px solid var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); cursor: pointer; }
	.preview :global(.runner) { width: 100%; }
</style>
