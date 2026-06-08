<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import { normalizeSteps } from '$lib/activities/rituels';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type Parcours = { id: string; titre: string; steps: unknown };
	let parcours = $state<Parcours[]>([]);
	let loading = $state(true);
	const ritCount = (p: Parcours) => normalizeSteps(p.steps).length;

	async function load() {
		// RLS : l'élève ne voit que les parcours qui lui sont assignés.
		const { data } = await getSupabase()
			.from('parcours')
			.select('id,titre,steps')
			.order('created_at', { ascending: false });
		parcours = (data ?? []) as Parcours[];
		loading = false;
	}
	onMount(load);
</script>

<h1>Mon espace</h1>
<p class="sub">Tes parcours, tes jeux, tes compétences.</p>

<h2>Tes parcours</h2>
{#if loading}
	<p class="muted">Chargement…</p>
{:else if parcours.length === 0}
	<EmptyState icon="🗺️" title="Aucun parcours pour l'instant" description="Ton professeur t'en assignera un. En attendant, tu peux jouer librement ci-dessous." />
{:else}
	<ul class="parcours">
		{#each parcours as p (p.id)}
			<li>
				<a href={`${base}/eleve/parcours/${p.id}`}>
					<span class="ico" aria-hidden="true">🗺️</span>
					<span class="t">{p.titre}</span>
					<span class="d">{ritCount(p)} rituel{ritCount(p) > 1 ? 's' : ''}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<h2 class="mt">Libre</h2>
<div class="cards">
	<a class="card play" href={`${base}/eleve/jouer`}>
		<span class="ico" aria-hidden="true">🎮</span>
		<span class="t">Jouer</span>
		<span class="d">Choisis une activité — tes réussites sont enregistrées.</span>
	</a>
	<a class="card" href={`${base}/eleve/competences`}>
		<span class="ico" aria-hidden="true">🌟</span>
		<span class="t">Mes compétences</span>
		<span class="d">Vois ta maîtrise progresser, tous supports confondus.</span>
	</a>
</div>

<style>
	.sub {
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-5);
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: var(--space-3);
	}
	.mt {
		margin-top: var(--space-6);
	}
	.parcours,
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--space-4);
		list-style: none;
		padding: 0;
	}
	.parcours a,
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-5);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: var(--text);
		transition: transform 0.12s, box-shadow 0.12s;
	}
	.parcours a {
		border-left: 4px solid var(--role-accent);
	}
	.parcours a:hover,
	.card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}
	.card.play {
		border-left: 4px solid var(--role-accent);
	}
	.ico {
		font-size: 2rem;
	}
	.t {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.d {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.muted {
		color: var(--text-muted);
	}
</style>
