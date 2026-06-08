<script lang="ts">
	// Validation DÉCLARATIVE par emojis (Tier 4 du spectre de captation — cf. mémoire
	// captation-validation-spectre). Pour les apps qu'on ne peut PAS capter (externes /
	// nouvel onglet) : l'élève déclare lui-même sa COMPRÉHENSION et sa SATISFACTION.
	// Universel, honnête (en entraînement on ne se ment qu'à soi), et métacognitif.
	// Émet { comprehension: 0..1, satisfaction: 0..1 | null } à la validation.
	let {
		onsubmit,
		submitting = false,
		done = false
	}: {
		onsubmit: (r: { comprehension: number; satisfaction: number | null }) => void;
		submitting?: boolean;
		done?: boolean;
	} = $props();

	const COMPREHENSION = [
		{ e: '😵‍💫', label: 'Perdu', v: 0 },
		{ e: '🤔', label: 'Pas sûr', v: 1 / 3 },
		{ e: '🙂', label: 'Compris', v: 2 / 3 },
		{ e: '😎', label: 'Maîtrisé', v: 1 }
	];
	const SATISFACTION = [
		{ e: '😣', label: 'Bof', v: 0 },
		{ e: '😐', label: 'Moyen', v: 1 / 3 },
		{ e: '🙂', label: 'Bien', v: 2 / 3 },
		{ e: '🤩', label: 'Top', v: 1 }
	];

	let comp = $state<number | null>(null);
	let sat = $state<number | null>(null);

	function submit() {
		if (comp === null || submitting) return;
		onsubmit({ comprehension: comp, satisfaction: sat });
	}
</script>

<div class="selfval">
	{#if done}
		<p class="thanks">✅ Merci, c'est enregistré !</p>
	{:else}
		<p class="intro">Quand tu as terminé, dis-nous :</p>

		<fieldset>
			<legend>As-tu compris&nbsp;?</legend>
			<div class="row">
				{#each COMPREHENSION as o (o.v)}
					<button type="button" class="emo" class:on={comp === o.v} onclick={() => (comp = o.v)}>
						<span class="e">{o.e}</span><span class="l">{o.label}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Ça t'a plu&nbsp;? <span class="opt">(facultatif)</span></legend>
			<div class="row">
				{#each SATISFACTION as o (o.v)}
					<button type="button" class="emo" class:on={sat === o.v} onclick={() => (sat = o.v)}>
						<span class="e">{o.e}</span><span class="l">{o.label}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<button class="validate" disabled={comp === null || submitting} onclick={submit}>
			{submitting ? 'Enregistrement…' : 'Valider'}
		</button>
	{/if}
</div>

<style>
	.selfval {
		margin-top: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		display: grid;
		gap: var(--space-3);
	}
	.intro {
		font-weight: 600;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}
	legend {
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0;
	}
	legend .opt {
		font-weight: 400;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.emo {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		padding: 0.5rem 0.8rem;
		min-width: 4.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		cursor: pointer;
		transition: transform 0.1s, border-color 0.1s, background 0.1s;
	}
	.emo:hover {
		transform: translateY(-1px);
		border-color: var(--role-accent);
	}
	.emo.on {
		border-color: var(--role-accent);
		background: var(--role-accent-soft);
	}
	.emo .e {
		font-size: 1.7rem;
		line-height: 1;
	}
	.emo .l {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.emo.on .l {
		color: var(--role-accent);
		font-weight: 600;
	}
	.validate {
		justify-self: start;
		font-weight: 700;
		padding: 0.6rem 1.2rem;
		border: 1px solid var(--role-accent);
		background: var(--role-accent);
		color: #fff;
		border-radius: var(--radius);
		cursor: pointer;
	}
	.validate:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.thanks {
		font-weight: 700;
		color: var(--success);
	}
</style>
