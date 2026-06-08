<script lang="ts">
	// Navigateur de bibliothèque : arbre Domaine → étiquette GS → activités, + recherche + facettes.
	// On n'affiche jamais « tout » à plat : l'arbre se reconstruit depuis le sous-ensemble filtré.
	import { ACTIVITIES, type Activity } from '$lib/activities/catalog';
	import { DOMAINES, type Comp, type ActivitySource, type Support } from '$lib/activities/types';
	import { filter, countBy, type FacetState } from '$lib/activities/library';
	import { buildTree } from '$lib/activities/tree';
	import ActivityPreview from '$components/library/ActivityPreview.svelte';

	const COMP_LABEL: Record<Comp, string> = { ch: 'chercher', mo: 'modéliser', re: 'représenter', ra: 'raisonner', ca: 'calculer', co: 'communiquer' };
	const SUPPORT: Record<Support, { e: string; l: string }> = {
		fiche: { e: '📄', l: 'Fiche' }, jeu: { e: '🎮', l: 'Jeu' }, video: { e: '🎬', l: 'Vidéo' },
		quiz: { e: '❓', l: 'Quiz' }, manipulable: { e: '🧩', l: 'Manipulable' }, tableur: { e: '📊', l: 'Tableur' },
		'geometrie-dyn': { e: '📐', l: 'Géométrie' }, lien: { e: '🔗', l: 'Lien' }
	};
	const DOM_HUE: Record<string, number> = {
		'01-nombres-et-calculs': 215, '02-grandeurs-et-mesures': 175, '03-espace-geometrie': 275,
		'04-donnees-probabilites': 30, '05-proportionnalite': 140, '06-pensee-informatique': 245,
		'07-resolution-problemes': 340, '00-transversal': 215
	};

	let q = $state('');
	let selDom = $state<string[]>([]);
	let selSup = $state<string[]>([]);
	let selComp = $state<string[]>([]);
	let selSrc = $state<string[]>([]);

	const supports = [...new Set(ACTIVITIES.map((a) => a.support))];
	const sources = [...new Set(ACTIVITIES.map((a) => a.source))];

	const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

	const facetState = $derived<FacetState>({
		q: q.trim() || undefined,
		domaines: selDom.length ? new Set(selDom) : undefined,
		supports: selSup.length ? new Set(selSup as Support[]) : undefined,
		comps: selComp.length ? new Set(selComp as Comp[]) : undefined,
		sources: selSrc.length ? new Set(selSrc as ActivitySource[]) : undefined
	});
	const filtered = $derived(filter(ACTIVITIES, facetState));
	const tree = $derived(buildTree(filtered));

	const cDom = $derived(countBy(ACTIVITIES, facetState, 'domaines', (a) => [a.taxo.domaineKey]));
	const cSup = $derived(countBy(ACTIVITIES, facetState, 'supports', (a) => [a.support]));
	const cComp = $derived(countBy(ACTIVITIES, facetState, 'comps', (a) => a.competences ?? []));
	const cSrc = $derived(countBy(ACTIVITIES, facetState, 'sources', (a) => [a.source]));

	const active = $derived(selDom.length + selSup.length + selComp.length + selSrc.length + (q.trim() ? 1 : 0));
	function reset() { q = ''; selDom = []; selSup = []; selComp = []; selSrc = []; }

	let preview = $state<Activity | null>(null); // activité ouverte en aperçu
</script>

<h1>Bibliothèque</h1>
<p class="sub">{filtered.length} activité{filtered.length > 1 ? 's' : ''} — rangées par ta taxonomie GS. Cherche, filtre, explore.</p>

<input class="search" bind:value={q} placeholder="🔍 Rechercher (mot-clé, code GS comme 24.4…)" aria-label="Recherche" />

<div class="facets">
	<div class="frow"><span class="fl">Domaine</span>
		{#each DOMAINES as d (d.key)}
			{@const n = cDom.get(d.key) ?? 0}
			<button class="chip" class:on={selDom.includes(d.key)} disabled={n === 0 && !selDom.includes(d.key)} style="--h:{DOM_HUE[d.key]}" onclick={() => (selDom = toggle(selDom, d.key))}>{d.label} <i>{n}</i></button>
		{/each}
	</div>
	<div class="frow"><span class="fl">Compétence</span>
		{#each Object.keys(COMP_LABEL) as c (c)}
			{@const n = cComp.get(c as Comp) ?? 0}
			<button class="chip" class:on={selComp.includes(c)} disabled={n === 0 && !selComp.includes(c)} onclick={() => (selComp = toggle(selComp, c))}>{COMP_LABEL[c as Comp]} <i>{n}</i></button>
		{/each}
	</div>
	<div class="frow"><span class="fl">Support</span>
		{#each supports as s (s)}
			{@const n = cSup.get(s) ?? 0}
			<button class="chip" class:on={selSup.includes(s)} disabled={n === 0 && !selSup.includes(s)} onclick={() => (selSup = toggle(selSup, s))}>{SUPPORT[s].e} {SUPPORT[s].l} <i>{n}</i></button>
		{/each}
	</div>
	<div class="frow"><span class="fl">Source</span>
		{#each sources as s (s)}
			{@const n = cSrc.get(s) ?? 0}
			<button class="chip" class:on={selSrc.includes(s)} disabled={n === 0 && !selSrc.includes(s)} onclick={() => (selSrc = toggle(selSrc, s))}>{s} <i>{n}</i></button>
		{/each}
	</div>
	{#if active}<button class="reset" onclick={reset}>↺ Réinitialiser ({active})</button>{/if}
</div>

{#if tree.length === 0}
	<p class="empty">Aucune activité ne correspond. Élargis les filtres.</p>
{:else}
	<div class="tree">
		{#each tree as dom (dom.key)}
			<section class="dom" style="--h:{DOM_HUE[dom.key]}">
				<h2>{dom.label} <span class="n">{dom.count}</span></h2>
				{#each dom.sousThemes as st (st.key)}
					<div class="st">
						<h3>{st.label}</h3>
						<div class="cards">
							{#each st.leaves as leaf (leaf.gs ?? '∅')}
								{#each leaf.activities as a (a.id)}
									<button class="card" onclick={() => (preview = a)} title="Aperçu de {a.label}">
										<span class="ico">{a.emoji ?? SUPPORT[a.support].e}</span>
										<div class="meta">
											<span class="t">{a.label}</span>
											<span class="tags">
												{#if leaf.gs}<span class="tag gs2">{leaf.gs}</span>{/if}
												<span class="tag">{SUPPORT[a.support].e}</span>
												{#each a.competences ?? [] as c (c)}<span class="tag comp">{c}</span>{/each}
											</span>
										</div>
									</button>
								{/each}
							{/each}
						</div>
					</div>
				{/each}
			</section>
		{/each}
	</div>
{/if}

{#if preview}
	<ActivityPreview activity={preview} onclose={() => (preview = null)} />
{/if}

<style>
	.sub { color: var(--text-muted); margin: var(--space-1) 0 var(--space-3); font-size: 0.85rem; }
	.search { width: 100%; padding: 0.45rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.9rem; margin-bottom: var(--space-2); }
	.facets { display: grid; gap: 0.25rem; margin-bottom: var(--space-3); }
	.frow { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
	.fl { font-size: 0.62rem; font-weight: 700; color: var(--text-muted); width: 4.5rem; text-transform: uppercase; letter-spacing: 0.03em; flex: none; }
	.chip { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-full); padding: 0.12rem 0.5rem; font-size: 0.72rem; cursor: pointer; display: inline-flex; gap: 0.2rem; align-items: center; line-height: 1.35; min-height: 0; }
	.chip i { font-style: normal; font-size: 0.62rem; opacity: 0.6; }
	.chip.on { background: hsl(var(--h, 215) 70% 94%); border-color: hsl(var(--h, 215) 60% 55%); color: hsl(var(--h, 215) 55% 32%); font-weight: 600; }
	.chip:disabled { opacity: 0.35; cursor: default; }
	.reset { justify-self: start; border: none; background: none; color: var(--role-accent); cursor: pointer; font-weight: 600; padding: 0.1rem 0; font-size: 0.78rem; min-height: 0; }
	.empty { color: var(--text-muted); padding: var(--space-6); text-align: center; }
	.tree { display: grid; gap: var(--space-3); }
	.dom { border-left: 3px solid hsl(var(--h) 60% 55%); padding-left: var(--space-3); }
	.dom h2 { font-size: 0.98rem; color: hsl(var(--h) 55% 38%); margin: 0; }
	.dom h2 .n { font-size: 0.75rem; color: var(--text-muted); font-weight: 400; }
	.st { margin-top: var(--space-2); }
	.st h3 { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.25rem; }
	.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.35rem; }
	.card { display: flex; gap: 0.4rem; align-items: center; padding: 0.25rem 0.4rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; text-align: left; width: 100%; min-width: 0; min-height: 0; transition: transform 0.1s, border-color 0.1s, box-shadow 0.1s; }
	.card:hover { border-color: var(--role-accent); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
	.ico { font-size: 1.15rem; flex: none; }
	.meta { display: grid; gap: 0.1rem; min-width: 0; }
	.t { font-weight: 600; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.tags { display: flex; gap: 0.2rem; flex-wrap: nowrap; overflow: hidden; }
	.tag { font-size: 0.6rem; padding: 0.03rem 0.32rem; border-radius: var(--radius-full); background: var(--gray-100); color: var(--text-muted); white-space: nowrap; flex: none; }
	.tag.comp { background: var(--role-accent-soft); color: var(--role-accent); text-transform: uppercase; }
	.tag.gs2 { background: var(--gray-900); color: #fff; font-weight: 700; }
</style>
