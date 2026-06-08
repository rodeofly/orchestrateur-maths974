<script lang="ts">
	// Couleur dérivée d'une graine OPAQUE (student_key/userId), JAMAIS du prénom (audit RGPD).
	// `name` ne sert qu'à l'affichage interne des initiales — jamais transmis à une iframe.
	let { name = '', seed = '' }: { name?: string; seed?: string } = $props();

	function initials(n: string): string {
		const parts = n.trim().split(/\s+/).filter(Boolean);
		if (!parts.length) return '·';
		return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
	}
	function hue(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
		return h;
	}
	const h = $derived(hue(seed || name));
</script>

<span class="avatar" style="--h: {h}" aria-hidden="true">{initials(name)}</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		font-size: 0.85rem;
		font-weight: 700;
		color: hsl(var(--h) 55% 32%);
		background: hsl(var(--h) 70% 90%);
	}
</style>
