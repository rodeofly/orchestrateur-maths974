<script lang="ts">
	// L'élève choisit une activité dans le CATALOGUE, la joue embarquée, et chaque
	// tentative est ENREGISTRÉE en base (RLS : student_id = auth.uid()).
	import RunnerFrame from '$components/runner/RunnerFrame.svelte';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';
	import { ACTIVITIES, activityUrl, type Activity } from '$lib/activities/catalog';

	let selected = $state<Activity | null>(null);
	let saved = $state(0);
	let lastErr = $state('');

	type AttemptResult = {
		app: string;
		activityId: string;
		outcome?: { passed?: boolean; score?: number | null };
		measures?: unknown;
		competencies?: unknown;
		kind?: string;
	};

	function choose(a: Activity) {
		selected = a;
		saved = 0;
		lastErr = '';
	}

	async function onAttempt(p: unknown) {
		const a = p as AttemptResult;
		const { error } = await getSupabase()
			.from('attempts')
			.insert({
				student_id: session.userId,
				app: a.app,
				activity_id: a.activityId,
				passed: a.outcome?.passed ?? false,
				score: a.outcome?.score ?? null,
				outcome: a.outcome ?? {},
				measures: a.measures ?? {},
				competencies: a.competencies ?? [],
				kind: a.kind ?? 'graded'
			});
		if (error) lastErr = error.message;
		else saved += 1;
	}
</script>

<h1>Jouer</h1>
<p class="sub">Choisis une activité. Tes réussites sont enregistrées et nourrissent tes compétences.</p>

{#if !selected}
	<ul class="grid">
		{#each ACTIVITIES as a (a.id)}
			<li>
				<button class="card" onclick={() => choose(a)}>
					<span class="ico" aria-hidden="true">{a.emoji ?? '🎮'}</span>
					<span class="t">{a.label}</span>
					{#if a.description}<span class="d">{a.description}</span>{/if}
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<div class="bar">
		<button class="back" onclick={() => (selected = null)}>← Choisir une autre activité</button>
		<span class="now">{selected.emoji} {selected.label}</span>
		<span class="status">
			{#if saved > 0}<span class="ok">✅ {saved} réussite{saved > 1 ? 's' : ''} enregistrée{saved > 1 ? 's' : ''}</span>{/if}
			{#if lastErr}<span class="err">⚠ {lastErr}</span>{/if}
		</span>
	</div>
	{#key selected.id}
		<RunnerFrame
			url={activityUrl(selected)}
			params={{ kind: selected.kind, studentKey: session.studentKey ?? undefined }}
			allowOrigin="*"
			title={selected.label}
			onattempt={onAttempt}
		/>
	{/key}
{/if}

<style>
	.sub {
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-5);
	}
	.grid {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--space-4);
	}
	.card {
		width: 100%;
		text-align: left;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-5);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px solid var(--role-accent);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		transition: transform 0.12s, box-shadow 0.12s;
	}
	.card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
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
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-bottom: var(--space-3);
	}
	.back {
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 0.45rem 0.8rem;
		cursor: pointer;
		font-weight: 600;
	}
	.now {
		font-weight: 700;
	}
	.status {
		margin-left: auto;
	}
	.ok {
		color: var(--success);
		font-weight: 600;
	}
	.err {
		color: var(--danger);
	}
</style>
