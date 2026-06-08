<script lang="ts">
	// Agrège les tentatives de l'élève (RLS : il ne voit que les siennes) en maîtrise
	// par compétence, via le référentiel vendoré (@maths974/competences).
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase/client';
	import { SKILLS, MACRO, tierFromRate } from '$m974/referential.js';
	import TierBadge from '$components/ui/TierBadge.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type Tier = 'fragile' | 'satisfaisant' | 'tres-satisfaisant' | 'expert';
	type Comp = string | { id: string; ok?: boolean };
	type Row = { passed: boolean; competencies: Comp[] };
	type Stat = { id: string; label: string; ok: number; total: number; rate: number; tier: Tier | null };

	let stats = $state<Stat[]>([]);
	let loading = $state(true);
	let err = $state('');

	function labelOf(id: string): string {
		return (SKILLS as Record<string, { label: string }>)[id]?.label ?? (MACRO as Record<string, string>)[id] ?? id;
	}

	async function load() {
		loading = true;
		err = '';
		try {
			const { data, error } = await getSupabase()
				.from('attempts')
				.select('passed, competencies');
			if (error) throw error;
			const acc = new Map<string, { ok: number; total: number }>();
			for (const r of (data ?? []) as Row[]) {
				for (const c of r.competencies ?? []) {
					const id = typeof c === 'string' ? c : c.id;
					const ok = typeof c === 'string' ? r.passed : !!c.ok;
					if (!id) continue;
					const e = acc.get(id) ?? { ok: 0, total: 0 };
					e.total += 1;
					if (ok) e.ok += 1;
					acc.set(id, e);
				}
			}
			stats = [...acc.entries()]
				.map(([id, { ok, total }]) => {
					const rate = total ? ok / total : 0;
					return { id, label: labelOf(id), ok, total, rate, tier: tierFromRate(rate, total) as Tier | null };
				})
				.sort((a, b) => b.total - a.total);
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	onMount(load);
</script>

<h1>Mes compétences</h1>
<p class="sub">Ta maîtrise, mise à jour à chaque réussite, tous supports confondus.</p>

{#if loading}
	<p class="muted">Chargement…</p>
{:else if err}
	<p class="err">{err}</p>
{:else if stats.length === 0}
	<EmptyState icon="🌱" title="Pas encore de compétence" description="Va dans « Jouer » et termine une activité : tes compétences apparaîtront ici." />
{:else}
	<ul class="list">
		{#each stats as s (s.id)}
			<li>
				<div class="left">
					<span class="label">{s.label}</span>
					<span class="ratio">{s.ok}/{s.total} réussites</span>
				</div>
				{#if s.tier}<TierBadge tier={s.tier} />{:else}<span class="encours">en cours…</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.sub {
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-4);
	}
	.list {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.left {
		display: grid;
	}
	.label {
		font-weight: 600;
	}
	.ratio {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.encours {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.err {
		color: var(--danger);
	}
	.muted {
		color: var(--text-muted);
	}
</style>
