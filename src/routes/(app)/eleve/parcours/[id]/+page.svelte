<script lang="ts">
	// Lecteur de séance : enchaîne les activités DANS LEUR RITUEL ; chaque réussite est
	// enregistrée (RLS student_id = auth.uid()), enrichie des compétences du rituel.
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';
	import { getActivity, activityUrl, type Activity } from '$lib/activities/catalog';
	import { normalizeSteps, getRituel, withRituelCompetences, type RituelType } from '$lib/activities/rituels';
	import RunnerFrame from '$components/runner/RunnerFrame.svelte';
	import SelfValidation from '$components/runner/SelfValidation.svelte';
	import { bridgeFor } from '$lib/activities/bridges';

	const id = $derived(page.params.id ?? '');

	type Parcours = { id: string; titre: string; steps: unknown };
	let parcours = $state<Parcours | null>(null);
	let loading = $state(true);
	let err = $state('');
	let idx = $state(0);
	let savedAt = $state<Record<number, number>>({});

	// Aplatit la séance en une suite de « plays » : une activité dans son rituel.
	type Play = { rituel: RituelType; activityId: string };
	const plays = $derived<Play[]>(
		normalizeSteps(parcours?.steps).flatMap((r) => r.activities.map((a) => ({ rituel: r.rituel, activityId: a })))
	);
	const current = $derived<Activity | undefined>(plays[idx] ? getActivity(plays[idx].activityId) : undefined);
	const rit = $derived(plays[idx] ? getRituel(plays[idx].rituel) : null);

	async function load() {
		loading = true;
		err = '';
		try {
			const { data, error } = await getSupabase().from('parcours').select('id,titre,steps').eq('id', id).single();
			if (error) throw error;
			parcours = data as Parcours;
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		if (id) load();
	});

	type AttemptResult = {
		app: string;
		activityId: string;
		outcome?: { passed?: boolean; score?: number | null };
		measures?: unknown;
		competencies?: unknown;
		kind?: string;
	};

	async function onAttempt(p: unknown) {
		const a = p as AttemptResult;
		const passed = a.outcome?.passed ?? false;
		const competencies = withRituelCompetences(a.competencies, plays[idx].rituel, passed);
		const { error } = await getSupabase().from('attempts').insert({
			student_id: session.userId,
			app: a.app,
			activity_id: a.activityId,
			passed,
			score: a.outcome?.score ?? null,
			outcome: a.outcome ?? {},
			measures: a.measures ?? {},
			competencies,
			kind: a.kind ?? 'graded'
		});
		if (!error) savedAt = { ...savedAt, [idx]: (savedAt[idx] ?? 0) + 1 };
	}

	// Validation DÉCLARATIVE (Tier 4) pour les étapes en app externe (newtab). Provenance
	// dans outcome.source='self' ; pas de compétences remontées (≠ maîtrise captée).
	let savingSelf = $state(false);
	let selfDoneAt = $state<Record<number, boolean>>({});
	async function onSelfValidate(r: { comprehension: number; satisfaction: number | null }) {
		if (!current) return;
		savingSelf = true;
		const passed = r.comprehension >= 0.5;
		const { error } = await getSupabase().from('attempts').insert({
			student_id: session.userId,
			app: current.source,
			activity_id: current.id,
			passed,
			score: r.comprehension,
			outcome: { passed, score: r.comprehension, source: 'self' },
			measures: {
				comprehension: r.comprehension,
				...(r.satisfaction !== null ? { satisfaction: r.satisfaction } : {})
			},
			competencies: [],
			kind: current.kind === 'consult' ? 'consult' : 'graded'
		});
		savingSelf = false;
		if (!error) {
			savedAt = { ...savedAt, [idx]: (savedAt[idx] ?? 0) + 1 };
			selfDoneAt = { ...selfDoneAt, [idx]: true };
		}
	}

	const next = () => { if (idx < plays.length - 1) idx += 1; };
	const prev = () => { if (idx > 0) idx -= 1; };
</script>

<p class="back"><a href={`${base}/eleve`}>← Mon espace</a></p>

{#if loading}
	<p class="muted">Chargement…</p>
{:else if err}
	<p class="err">{err}</p>
{:else if parcours}
	<h1>{parcours.titre}</h1>

	<div class="stepper">
		{#each plays as p, i (i)}
			<span class="dot" class:active={i === idx} class:done={(savedAt[i] ?? 0) > 0} title={getRituel(p.rituel).label}>{getRituel(p.rituel).emoji}</span>
		{/each}
	</div>

	{#if current && rit}
		<div class="head">
			<span class="rit">{rit.emoji} {rit.label}</span>
			<span class="now">Étape {idx + 1}/{plays.length} — {current.emoji} {current.label}</span>
			{#if (savedAt[idx] ?? 0) > 0}<span class="ok">✅ {savedAt[idx]}</span>{/if}
		</div>
		{#key idx}
			<RunnerFrame
				url={activityUrl(current)}
				params={{ kind: current.kind, studentKey: session.studentKey ?? undefined }}
				allowOrigin="*"
				title={current.label}
				height="66vh"
				mode={current.embed.mode}
				adapter={bridgeFor(current.source)}
				onattempt={onAttempt}
			/>
		{/key}
		{#if current.embed.mode === 'newtab'}
			<!-- App externe non captable → capture déclarative par emojis (Tier 4). -->
			<SelfValidation onsubmit={onSelfValidate} submitting={savingSelf} done={selfDoneAt[idx] ?? false} />
		{/if}
		<div class="nav">
			<button onclick={prev} disabled={idx === 0}>← Précédent</button>
			{#if idx < plays.length - 1}
				<button class="primary" onclick={next}>Suivant →</button>
			{:else}
				<a class="primary done-link" href={`${base}/eleve/competences`}>Terminer — mes compétences 🌟</a>
			{/if}
		</div>
	{:else}
		<p class="err">Séance vide ou activité inconnue.</p>
	{/if}
{/if}

<style>
	.back { margin-bottom: var(--space-2); }
	.stepper { display: flex; gap: var(--space-2); margin: var(--space-3) 0; flex-wrap: wrap; }
	.dot { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; border: 2px solid var(--border); font-size: 0.95rem; }
	.dot.active { border-color: var(--role-accent); box-shadow: 0 0 0 2px var(--role-accent-soft); }
	.dot.done { background: var(--success); border-color: var(--success); }
	.head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2); flex-wrap: wrap; }
	.rit { font-weight: 700; color: var(--role-accent); background: var(--role-accent-soft); padding: 0.15rem 0.6rem; border-radius: var(--radius-full); }
	.now { font-weight: 600; }
	.ok { color: var(--success); font-weight: 700; }
	.nav { display: flex; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-3); }
	.nav button, .nav .primary { padding: 0.6rem 1.1rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); font-weight: 600; cursor: pointer; text-decoration: none; color: var(--text); }
	.nav .primary { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	.nav button:disabled { opacity: 0.5; cursor: default; }
	.muted { color: var(--text-muted); }
	.err { color: var(--danger); }
</style>
