<script lang="ts">
	// Palier de maîtrise (cf. référentiel @maths974/competences : fragile→expert).
	type Tier = 'fragile' | 'satisfaisant' | 'tres-satisfaisant' | 'expert';
	const LABELS: Record<Tier, string> = {
		fragile: 'Fragile',
		satisfaisant: 'Satisfaisant',
		'tres-satisfaisant': 'Très satisfaisant',
		expert: 'Expert'
	};
	let { tier }: { tier: Tier } = $props();
</script>

<span class="tier" style="--c: var(--tier-{tier})">{LABELS[tier]}</span>

<style>
	.tier {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.15rem 0.6rem;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 14%, white);
	}
	.tier::before {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--c);
	}
</style>
