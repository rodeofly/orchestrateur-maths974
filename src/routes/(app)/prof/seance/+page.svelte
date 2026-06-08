<script lang="ts">
	// DÉMO du runner : embarque une activité et montre ses tentatives remonter en direct.
	// Prouve la chaîne complète (orchestrateur ↔ connecteur ↔ activité). Le suivi réel
	// (enregistrement en base, parcours) viendra avec l'espace élève + l'éditeur de parcours.
	import RunnerFrame from '$components/runner/RunnerFrame.svelte';
	import { ACTIVITIES, activityUrl } from '$lib/activities/catalog';
	import { bridgeFor } from '$lib/activities/bridges';

	function pickFromCatalog(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const a = ACTIVITIES.find((x) => x.id === id);
		if (a) {
			url = activityUrl(a);
			source = a.source;
		}
	}

	let url = $state('http://localhost:5173/');
	let source = $state<string | undefined>(undefined);
	let activity = $state('lesson:a');
	let running = $state(false);
	let events = $state<{ kind: string; payload: unknown }[]>([]);
	let runner = $state<{ command: (a: string, e?: Record<string, unknown>) => void }>();

	function start() {
		events = [];
		running = true;
	}
	function stop() {
		running = false;
	}
	function log(kind: string, payload: unknown) {
		events = [{ kind, payload }, ...events];
	}
</script>

<h1>Aperçu d'une activité <span class="tag">test connecteur</span></h1>
<p class="sub">
	Outil de <strong>test</strong> : embarque une activité et observe ses tentatives arriver en direct.
	⚠️ Cet aperçu <strong>n'enregistre rien</strong> — il sert à vérifier le branchement. Les vraies
	réussites sont enregistrées quand un <strong>élève</strong> joue (depuis son espace).
</p>

<div class="controls">
	<label>Catalogue
		<select onchange={pickFromCatalog}>
			<option value="">— choisir —</option>
			{#each ACTIVITIES as a (a.id)}<option value={a.id}>{a.emoji} {a.label}</option>{/each}
		</select>
	</label>
	<label>URL de l'activité <input bind:value={url} spellcheck="false" /></label>
	<label>activité <input bind:value={activity} spellcheck="false" /></label>
	{#if !running}
		<button class="go" onclick={start}>Monter ▶</button>
	{:else}
		<button class="go stop" onclick={stop}>Démonter ✕</button>
	{/if}
</div>

<div class="stage">
	<div class="frame">
		{#if running}
			{#key url + activity}
				<RunnerFrame
					bind:this={runner}
					{url}
					params={{ activity, kind: 'graded', timeLimit: 120 }}
					allowOrigin="*"
					title="activité embarquée"
					adapter={bridgeFor(source)}
					onready={(p) => log('ready', p)}
					onattempt={(p) => log('attempt', p)}
					onprogress={(p) => log('progress', p)}
					onexit={(p) => log('exit', p)}
				/>
			{/key}
		{:else}
			<div class="placeholder">L'activité s'affichera ici.</div>
		{/if}
	</div>

	<aside class="panel">
		<div class="cmd">
			<button onclick={() => runner?.command('pause')} disabled={!running}>pause</button>
			<button onclick={() => runner?.command('resume')} disabled={!running}>resume</button>
			<button onclick={() => runner?.command('reset')} disabled={!running}>reset</button>
			<button onclick={() => runner?.command('timeup')} disabled={!running}>timeup</button>
		</div>
		<h2>Événements reçus</h2>
		<div class="log">
			{#if events.length === 0}
				<p class="muted">Joue dans l'activité pour voir les tentatives remonter…</p>
			{:else}
				{#each events as e, i (i)}
					<div class="ev {e.kind}">
						<span class="k">{e.kind}</span>
						<pre>{JSON.stringify(e.payload, null, 2)}</pre>
					</div>
				{/each}
			{/if}
		</div>
	</aside>
</div>

<style>
	.tag {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--role-accent);
		background: var(--role-accent-soft);
		padding: 0.1rem 0.5rem;
		border-radius: var(--radius-full);
		vertical-align: middle;
	}
	.sub {
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-4);
	}
	.controls {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		align-items: end;
		margin-bottom: var(--space-4);
	}
	.controls label {
		display: grid;
		gap: var(--space-1);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		flex: 1 1 16rem;
	}
	.controls input {
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}
	.go {
		background: var(--role-accent);
		color: #fff;
		border: none;
		padding: 0.6rem 1.1rem;
		border-radius: var(--radius);
		font-weight: 700;
		cursor: pointer;
	}
	.go.stop {
		background: var(--gray-600);
	}
	.stage {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-4);
	}
	.placeholder {
		min-height: 60vh;
		display: grid;
		place-items: center;
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.cmd {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.cmd button {
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}
	.panel h2 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.log {
		flex: 1;
		overflow: auto;
		max-height: 60vh;
	}
	.ev {
		border-left: 3px solid var(--gray-300);
		background: var(--gray-50);
		border-radius: var(--radius-sm);
		padding: 0.4rem 0.5rem;
		margin-bottom: var(--space-2);
	}
	.ev.attempt {
		border-color: var(--success);
		background: color-mix(in srgb, var(--success) 8%, white);
	}
	.ev.ready {
		border-color: var(--info);
	}
	.ev .k {
		font-weight: 700;
		font-size: 0.8rem;
	}
	.ev pre {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.muted {
		color: var(--text-muted);
	}
	@media (min-width: 980px) {
		.stage {
			grid-template-columns: 1fr 24rem;
		}
	}
</style>
