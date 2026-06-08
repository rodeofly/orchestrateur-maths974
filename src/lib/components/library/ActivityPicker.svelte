<script lang="ts">
	// Sélecteur d'activité CONTEXTUEL : s'ouvre déjà pré-filtré par le rituel du slot.
	// Recommandé d'abord (affinité rituel/compétences), recherche + facette domaine, repli « tout ».
	import { ACTIVITIES } from '$lib/activities/catalog';
	import { getRituel, type RituelType } from '$lib/activities/rituels';
	import { DOMAINES } from '$lib/activities/types';
	import { filter, countBy, type FacetState } from '$lib/activities/library';
	import { candidatesFor, score } from '$lib/activities/compat';
	import { detectActivity } from '$lib/activities/detect';

	let {
		rituel,
		onpick,
		onclose
	}: { rituel: RituelType; onpick: (id: string) => void; onclose: () => void } = $props();

	const rit = $derived(getRituel(rituel));
	const reco = $derived(candidatesFor(rituel));

	let all = $state(false);
	let q = $state('');
	let selDom = $state<string[]>([]);

	// Coller un lien externe (Khan, mathaléa, LearningApps…) → activité « newtab ».
	let link = $state('');
	const detected = $derived(link.trim() ? detectActivity(link) : null);
	const addLink = () => {
		if (detected) {
			onpick(detected.id);
			link = '';
		}
	};

	const pool = $derived(all ? ACTIVITIES : reco);
	const facets = $derived<FacetState>({
		q: q.trim() || undefined,
		domaines: selDom.length ? new Set(selDom) : undefined
	});
	const results = $derived(filter(pool, facets).sort((a, b) => score(b, rituel) - score(a, rituel)));
	const cDom = $derived(countBy(pool, facets, 'domaines', (a) => [a.taxo.domaineKey]));
	const toggle = (k: string) => (selDom = selDom.includes(k) ? selDom.filter((x) => x !== k) : [...selDom, k]);
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="panel" role="dialog" aria-label="Ajouter une activité">
	<header>
		<span>Ajouter au rituel <strong>{rit.emoji} {rit.label}</strong></span>
		<button class="x" onclick={onclose} aria-label="Fermer">✕</button>
	</header>

	<div class="controls">
		<input bind:value={q} placeholder="🔍 Rechercher (mot-clé, code GS comme 24.4…)" aria-label="Recherche" />
		<label class="all"><input type="checkbox" bind:checked={all} /> tout le catalogue</label>
	</div>

	<div class="chips">
		{#each DOMAINES as d (d.key)}
			{@const n = cDom.get(d.key) ?? 0}
			{#if n || selDom.includes(d.key)}
				<button class="chip" class:on={selDom.includes(d.key)} onclick={() => toggle(d.key)}>{d.label} <i>{n}</i></button>
			{/if}
		{/each}
	</div>

	<p class="hint">{all ? 'Tout le catalogue' : `Recommandé pour un ${rit.label}`} — {results.length} activité{results.length > 1 ? 's' : ''}</p>

	<div class="list">
		{#if results.length === 0}
			<p class="muted">Rien ne correspond. Élargis la recherche ou coche « tout le catalogue ».</p>
		{/if}
		{#each results.slice(0, 60) as a (a.id)}
			<button class="card" onclick={() => onpick(a.id)}>
				<span class="ico">{a.emoji ?? '📄'}</span>
				<span class="meta">
					<span class="t">{a.label}</span>
					<span class="sub">
						{#each a.taxo.gs ?? [] as g (g)}<i class="gs">{g}</i>{/each}
						<span class="dom">{a.taxo.domaineLabel ?? ''}</span>
					</span>
				</span>
				<span class="add">＋</span>
			</button>
		{/each}
		{#if results.length > 60}<p class="muted">… {results.length - 60} de plus — affine la recherche.</p>{/if}
	</div>

	<div class="mathalea-cfg">
		<button class="cfg" onclick={() => window.open('https://rodeofly.github.io/alea/', '_blank', 'noopener')}>🎲 Configurer un exercice MathsAlea974 ↗</button>
		<span class="cfg-steps">configure → « lien élève » → copie → colle ci-dessous</span>
	</div>
	<div class="paste">
		<input
			bind:value={link}
			placeholder="🔗 …colle ici le lien (exercice MathALEA, Khan, LearningApps…)"
			aria-label="Coller un lien"
			onkeydown={(e) => e.key === 'Enter' && addLink()}
		/>
		<button class="addlink" disabled={!detected} onclick={addLink}>Ajouter</button>
	</div>
	{#if link.trim() && !detected}
		<p class="paste-hint err">Lien non reconnu — il doit commencer par https://</p>
	{:else if detected}
		<p class="paste-hint">
			{detected.emoji} <strong>{detected.label}</strong> —
			{#if detected.embed.connector === 'bridged'}embarqué, <strong>réussites captées</strong> 🎯
			{:else}s'ouvrira dans un nouvel onglet (validation par emojis){/if}
		</p>
	{/if}
</div>

<style>
	.backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: var(--z-modal); }
	.panel { position: fixed; z-index: var(--z-modal); top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(40rem, 94vw); max-height: 86vh; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
	header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border); }
	.x { border: none; background: none; cursor: pointer; font-size: 1.1rem; color: var(--text-muted); }
	.controls { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4) 0; flex-wrap: wrap; }
	.controls input { flex: 1 1 16rem; padding: 0.55rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.all { font-size: 0.82rem; color: var(--text-muted); display: inline-flex; gap: 0.3rem; align-items: center; white-space: nowrap; }
	.chips { display: flex; gap: 0.35rem; flex-wrap: wrap; padding: var(--space-2) var(--space-4); }
	.chip { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-full); padding: 0.2rem 0.6rem; font-size: 0.78rem; cursor: pointer; }
	.chip i { font-style: normal; opacity: 0.6; font-size: 0.72rem; }
	.chip.on { background: var(--role-accent-soft); border-color: var(--role-accent); color: var(--role-accent); font-weight: 600; }
	.hint { padding: 0 var(--space-4) var(--space-2); font-size: 0.82rem; color: var(--text-muted); }
	.list { overflow: auto; padding: 0 var(--space-3) var(--space-3); display: grid; gap: 0.3rem; }
	.card { display: flex; align-items: center; gap: var(--space-2); padding: 0.5rem 0.7rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; text-align: left; }
	.card:hover { border-color: var(--role-accent); background: var(--role-accent-soft); }
	.ico { font-size: 1.4rem; }
	.meta { flex: 1; min-width: 0; display: grid; gap: 0.15rem; }
	.t { font-weight: 600; font-size: 0.92rem; }
	.sub { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
	.sub .gs { font-style: normal; font-size: 0.68rem; font-weight: 700; background: var(--gray-900); color: #fff; padding: 0.02rem 0.4rem; border-radius: var(--radius-full); }
	.sub .dom { font-size: 0.74rem; color: var(--text-muted); }
	.add { font-size: 1.3rem; color: var(--role-accent); font-weight: 700; }
	.muted { color: var(--text-muted); padding: var(--space-3); }
	.mathalea-cfg { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; padding: var(--space-3) var(--space-4) 0; border-top: 1px solid var(--border); margin-top: var(--space-2); }
	.cfg { border: 1px solid var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.4rem 0.8rem; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
	.cfg-steps { font-size: 0.72rem; color: var(--text-muted); }
	.paste { display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-4) 0; }
	.paste input { flex: 1 1 auto; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.addlink { border: 1px solid var(--role-accent); background: var(--role-accent); color: #fff; border-radius: var(--radius); padding: 0.4rem 0.9rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.addlink:disabled { opacity: 0.45; cursor: not-allowed; }
	.paste-hint { padding: 0.3rem var(--space-4) var(--space-3); font-size: 0.8rem; color: var(--text-muted); }
	.paste-hint.err { color: var(--danger); }
</style>
