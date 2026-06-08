<script lang="ts">
	// Cockpit de séance : l'écran de pilotage du prof (projection classe).
	// Fond = tableau blanc, activité seule, OU une SÉANCE (on enchaîne ses rituels).
	// Outils flottants (chrono, tirage, calc) + annotation stylo/instruments. Plein écran.
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase/client';
	import { ACTIVITIES, activityUrl, getActivity } from '$lib/activities/catalog';
	import { normalizeSteps, getRituel, type RituelType } from '$lib/activities/rituels';
	import RunnerFrame from '$components/runner/RunnerFrame.svelte';
	import Chrono from '$components/cockpit/Chrono.svelte';
	import Tirage from '$components/cockpit/Tirage.svelte';
	import Calculatrice from '$components/cockpit/Calculatrice.svelte';
	import Annotation from '$components/cockpit/Annotation.svelte';
	import { draggable } from '$lib/actions/draggable';

	const COMP: Record<string, string> = { ch: 'chercher', mo: 'modéliser', re: 'représenter', ra: 'raisonner', ca: 'calculer', co: 'communiquer' };

	let cockpit = $state<HTMLDivElement>();
	let source = $state('blank');
	let annot = $state(false);
	let show = $state({ chrono: false, tirage: false, calc: false });

	type Play = { rituel: RituelType; activityId: string };
	let parcoursList = $state<{ id: string; titre: string; steps: unknown }[]>([]);
	let seance = $state<{ titre: string; plays: Play[] } | null>(null);
	let idx = $state(0);

	const isSeance = $derived(source.startsWith('seance:'));
	const backdrop = $derived(
		isSeance
			? (seance && seance.plays[idx] ? getActivity(seance.plays[idx].activityId) : null)
			: source === 'blank'
				? null
				: getActivity(source)
	);
	const rit = $derived(isSeance && seance?.plays[idx] ? getRituel(seance.plays[idx].rituel) : null);

	async function loadParcours() {
		const { data } = await getSupabase().from('parcours').select('id,titre,steps').order('created_at', { ascending: false });
		parcoursList = data ?? [];
	}
	function onSource() {
		if (isSeance) {
			const id = source.slice('seance:'.length);
			const p = parcoursList.find((x) => x.id === id);
			seance = p
				? { titre: p.titre, plays: normalizeSteps(p.steps).flatMap((r) => r.activities.map((a) => ({ rituel: r.rituel, activityId: a }))) }
				: null;
			idx = 0;
		} else {
			seance = null;
		}
	}
	const prev = () => { if (idx > 0) idx -= 1; };
	const next = () => { if (seance && idx < seance.plays.length - 1) idx += 1; };

	function toggleFullscreen() {
		if (!document.fullscreenElement) cockpit?.requestFullscreen?.();
		else document.exitFullscreen?.();
	}
	onMount(loadParcours);
</script>

<div class="cockpit" bind:this={cockpit}>
	<div class="stage">
		{#if backdrop}
			{#key (isSeance ? 's' + idx : '') + backdrop.id}
				<RunnerFrame url={activityUrl(backdrop)} params={{ kind: backdrop.kind }} allowOrigin="*" title={backdrop.label} height="100%" mode={backdrop.embed.mode} />
			{/key}
		{:else}
			<div class="board"></div>
		{/if}

		<Annotation active={annot} />

		{#if isSeance && rit && seance}
			<div class="ritbar">
				<button onclick={prev} disabled={idx === 0} aria-label="Précédent">‹</button>
				<span class="rb-rit">{rit.emoji} {rit.label}</span>
				<span class="rb-comp">{#each rit.competences as c (c)}<i>{COMP[c] ?? c}</i>{/each}</span>
				<span class="rb-time">⏱ ~{rit.dureeMin}′</span>
				<span class="rb-step">{idx + 1}/{seance.plays.length}</span>
				<button onclick={next} disabled={idx >= seance.plays.length - 1} aria-label="Suivant">›</button>
			</div>
		{/if}
	</div>

	<div class="toolbar">
		<select onchange={onSource} bind:value={source} title="Fond" aria-label="Fond">
			<option value="blank">⬜ Tableau blanc</option>
			<optgroup label="Activité">
				{#each ACTIVITIES as a (a.id)}<option value={a.id}>{a.emoji} {a.label}</option>{/each}
			</optgroup>
			{#if parcoursList.length}
				<optgroup label="Mes séances">
					{#each parcoursList as p (p.id)}<option value={`seance:${p.id}`}>🎬 {p.titre}</option>{/each}
				</optgroup>
			{/if}
		</select>
		<button class:on={annot} onclick={() => (annot = !annot)}>✏️ Annoter</button>
		<button class:on={show.chrono} onclick={() => (show.chrono = !show.chrono)}>⏱ Chrono</button>
		<button class:on={show.tirage} onclick={() => (show.tirage = !show.tirage)}>🎲 Tirage</button>
		<button class:on={show.calc} onclick={() => (show.calc = !show.calc)}>🧮 Calc</button>
		<button onclick={toggleFullscreen} title="Projeter">⛶ Plein écran</button>
	</div>

	{#if show.chrono}
		<div class="panel" use:draggable={{ handle: '.ph' }} style="top:4.5rem; left:1rem">
			<div class="ph"><span>⏱ Chrono</span><button onclick={() => (show.chrono = false)}>✕</button></div>
			<div class="pb"><Chrono /></div>
		</div>
	{/if}
	{#if show.tirage}
		<div class="panel" use:draggable={{ handle: '.ph' }} style="top:4.5rem; left:16rem">
			<div class="ph"><span>🎲 Tirage</span><button onclick={() => (show.tirage = false)}>✕</button></div>
			<div class="pb"><Tirage /></div>
		</div>
	{/if}
	{#if show.calc}
		<div class="panel" use:draggable={{ handle: '.ph' }} style="top:4.5rem; right:1rem">
			<div class="ph"><span>🧮 Calculatrice</span><button onclick={() => (show.calc = false)}>✕</button></div>
			<div class="pb"><Calculatrice /></div>
		</div>
	{/if}
</div>

<style>
	.cockpit { position: relative; }
	.stage { position: relative; height: 70vh; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface); }
	.board { position: absolute; inset: 0; background-color: #fff; background-image: linear-gradient(var(--gray-100) 1px, transparent 1px), linear-gradient(90deg, var(--gray-100) 1px, transparent 1px); background-size: 28px 28px; }
	.ritbar { position: absolute; top: var(--space-3); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-3); background: var(--gray-900); color: #fff; border-radius: var(--radius-full); padding: 0.35rem 0.6rem; box-shadow: var(--shadow); z-index: 25; }
	.ritbar button { width: 2rem; height: 2rem; min-height: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #fff; cursor: pointer; font-size: 1.1rem; line-height: 1; }
	.ritbar button:disabled { opacity: 0.35; cursor: default; }
	.rb-rit { font-weight: 800; }
	.rb-comp { display: flex; gap: 0.3rem; }
	.rb-comp i { font-style: normal; font-size: 0.7rem; background: rgba(255,255,255,0.18); padding: 0.05rem 0.45rem; border-radius: var(--radius-full); }
	.rb-time { font-size: 0.85rem; opacity: 0.85; }
	.rb-step { font-variant-numeric: tabular-nums; font-weight: 700; opacity: 0.9; }
	.toolbar { position: absolute; bottom: var(--space-3); left: 50%; transform: translateX(-50%); display: flex; gap: var(--space-2); align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 0.4rem 0.7rem; box-shadow: var(--shadow); z-index: 30; flex-wrap: wrap; }
	.toolbar select, .toolbar button { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); padding: 0.35rem 0.7rem; cursor: pointer; font-size: 0.85rem; min-height: 0; }
	.toolbar button.on { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	.panel { position: absolute; z-index: 40; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
	.ph { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 0.4rem 0.7rem; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 0.85rem; cursor: grab; user-select: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: var(--gray-50); }
	.ph button { border: none; background: none; cursor: pointer; color: var(--text-muted); min-height: 0; font-size: 0.9rem; }
	.pb { padding: var(--space-3); }
	.cockpit:fullscreen { background: var(--bg); padding: 0; }
	.cockpit:fullscreen .stage { height: 100vh; border: none; border-radius: 0; }
</style>
