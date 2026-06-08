<script lang="ts">
	// Éditeur de séance PAR RITUELS : le prof empile des rituels typés (rapido, zéfor,
	// problèmes, éval, bilan, divertissement), remplit chacun d'activités du catalogue,
	// puis assigne. Peut publier une séance comme MODÈLE Maths974, ou dupliquer un modèle.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';
	import { getActivity } from '$lib/activities/catalog';
	import ActivityPicker from '$components/library/ActivityPicker.svelte';
	import { RITUELS, getRituel, normalizeSteps, type RituelType, type SeanceStep } from '$lib/activities/rituels';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type Parcours = { id: string; titre: string; steps: unknown; author_id: string | null; is_published: boolean };
	type Classe = { id: string; nom: string };

	const COMP_LABELS: Record<string, string> = { ch: 'chercher', mo: 'modéliser', re: 'représenter', ra: 'raisonner', ca: 'calculer', co: 'communiquer' };

	let parcours = $state<Parcours[]>([]);
	let classes = $state<Classe[]>([]);
	let loading = $state(true);
	let err = $state('');

	// Composeur — REPLIÉ par défaut (on arrive sur la liste).
	let composerOpen = $state(false);
	let titre = $state('');
	let steps = $state<SeanceStep[]>([]);
	let creating = $state(false);
	let pickerFor = $state<number | null>(null); // index du rituel dont on choisit une activité
	let editingSeanceId = $state<string | null>(null); // édition d'une séance existante (?edit=)
	let loadedEdit = '';

	// Arrivée depuis l'arbre de progression (?edit=ID) → charge la séance dans le composeur.
	$effect(() => {
		const id = page.url.searchParams.get('edit');
		if (id && id !== loadedEdit) { loadedEdit = id; loadForEdit(id); }
	});
	async function loadForEdit(id: string) {
		const { data } = await getSupabase().from('parcours').select('id,titre,steps').eq('id', id).single();
		if (data) {
			titre = (data as { titre: string }).titre;
			steps = normalizeSteps((data as { steps: unknown }).steps);
			editingSeanceId = id;
			composerOpen = true;
		}
	}
	function toggleComposer() {
		composerOpen = !composerOpen;
		if (!composerOpen) { editingSeanceId = null; titre = ''; steps = []; loadedEdit = ''; }
	}

	let choice = $state<Record<string, string>>({});
	let msg = $state('');

	const mine = $derived(parcours.filter((p) => p.author_id === session.userId));
	const templates = $derived(parcours.filter((p) => p.is_published && p.author_id !== session.userId));

	async function load() {
		loading = true;
		err = '';
		try {
			const sb = getSupabase();
			const { data: p, error: pe } = await sb
				.from('parcours')
				.select('id,titre,steps,author_id,is_published')
				.order('created_at', { ascending: false });
			if (pe) throw pe;
			parcours = (p ?? []) as Parcours[];
			const { data: c, error: ce } = await sb.from('classes').select('id,nom').order('created_at');
			if (ce) throw ce;
			classes = (c ?? []) as Classe[];
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	const addRituel = (type: RituelType) => (steps = [...steps, { rituel: type, activities: [] }]);
	const removeRituel = (i: number) => (steps = steps.filter((_, j) => j !== i));
	function moveUp(i: number) {
		if (i === 0) return;
		const s = [...steps];
		[s[i - 1], s[i]] = [s[i], s[i - 1]];
		steps = s;
	}
	function addActivity(i: number, id: string) {
		if (!id) return;
		steps = steps.map((s, j) => (j === i ? { ...s, activities: [...s.activities, id] } : s));
	}
	function removeActivity(i: number, k: number) {
		steps = steps.map((s, j) => (j === i ? { ...s, activities: s.activities.filter((_, m) => m !== k) } : s));
	}

	const totalActivities = $derived(steps.reduce((n, s) => n + s.activities.length, 0));

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!titre.trim() || totalActivities === 0) return;
		creating = true;
		err = '';
		const sb = getSupabase();
		const { error } = editingSeanceId
			? await sb.from('parcours').update({ titre: titre.trim(), steps }).eq('id', editingSeanceId)
			: await sb.from('parcours').insert({
					titre: titre.trim(),
					etablissement_id: session.tenantId,
					author_id: session.userId,
					steps,
					is_published: false
				});
		if (error) err = error.message;
		else {
			titre = '';
			steps = [];
			editingSeanceId = null;
			loadedEdit = '';
			composerOpen = false; // on referme après enregistrement
			await load();
		}
		creating = false;
	}

	async function del(p: Parcours) {
		if (!confirm(`Supprimer la séance « ${p.titre} » ? (définitif)`)) return;
		msg = '';
		const { error } = await getSupabase().from('parcours').delete().eq('id', p.id);
		if (error) msg = `⚠ ${error.message}`;
		else parcours = parcours.filter((x) => x.id !== p.id);
	}

	async function assign(pId: string) {
		const classId = choice[pId];
		if (!classId) return;
		msg = '';
		const { error } = await getSupabase()
			.from('parcours_assignments')
			.insert({ parcours_id: pId, class_id: classId, assigned_by: session.userId });
		msg = error ? `⚠ ${error.message}` : '✅ Séance assignée à la classe.';
	}

	async function togglePublish(p: Parcours) {
		msg = '';
		const { error } = await getSupabase().from('parcours').update({ is_published: !p.is_published }).eq('id', p.id);
		if (error) msg = `⚠ ${error.message}`;
		else await load();
	}

	async function duplicate(p: Parcours) {
		msg = '';
		const { error } = await getSupabase().from('parcours').insert({
			titre: `${p.titre} (copie)`,
			etablissement_id: session.tenantId,
			author_id: session.userId,
			steps: p.steps,
			is_published: false
		});
		msg = error ? `⚠ ${error.message}` : '✅ Modèle dupliqué dans tes séances.';
		if (!error) await load();
	}

	const labelOf = (id: string) => getActivity(id)?.label ?? id;
	const emojiOf = (id: string) => getActivity(id)?.emoji ?? '🎲';
	const ritCount = (p: Parcours) => normalizeSteps(p.steps).length;

	onMount(load);
</script>

<p class="back"><a href={`${base}/prof/annee`}>← Progression</a></p>
<h1>Séances & parcours</h1>
<p class="sub">Édite une séance (rituels + activités) puis assigne-la. Tu y arrives depuis la <a href={`${base}/prof/annee`}>progression</a> (🔧 sur une séance).</p>

<section class="composer">
	<button type="button" class="composer-toggle" class:open={composerOpen} onclick={toggleComposer} aria-expanded={composerOpen}>
		<span class="ccaret">{composerOpen ? '▾' : '▸'}</span> {editingSeanceId ? '✏️ Modifier la séance' : '＋ Nouvelle séance'}
	</button>
	{#if composerOpen}
		<Card>
			<form onsubmit={create}>
				<input bind:value={titre} placeholder="Titre (ex. Proportionnalité — séance 1)" aria-label="Titre" />

				<p class="lbl">Ajouter un rituel :</p>
				<div class="palette">
					{#each RITUELS.filter((r) => r.type !== 'libre') as r (r.type)}
						<button type="button" class="chip" title={r.description} onclick={() => addRituel(r.type)}>{r.emoji} {r.label}</button>
					{/each}
				</div>

				<p class="lbl">Séance ({steps.length} rituel{steps.length > 1 ? 's' : ''}, {totalActivities} activité{totalActivities > 1 ? 's' : ''}) :</p>
				{#if steps.length === 0}
					<p class="muted">Empile des rituels ci-dessus, puis remplis-les d'activités.</p>
				{:else}
					<ol class="seq">
						{#each steps as s, i (i)}
							{@const def = getRituel(s.rituel)}
							<li>
								<div class="rit-head">
									<span class="rit-n">{i + 1}</span>
									<span class="rit-title">{def.emoji} {def.label}</span>
									<span class="comps">
										{#each def.competences as c (c)}<span class="comp">{COMP_LABELS[c] ?? c}</span>{/each}
									</span>
									<span class="rit-acts">
										<button type="button" onclick={() => moveUp(i)} disabled={i === 0} title="Monter">↑</button>
										<button type="button" onclick={() => removeRituel(i)} title="Retirer le rituel">✕</button>
									</span>
								</div>
								<div class="rit-body">
									{#if s.activities.length}
										<ul class="acts">
											{#each s.activities as a, k (k)}
												<li><span>{emojiOf(a)} {labelOf(a)}</span><button type="button" onclick={() => removeActivity(i, k)} title="Retirer">✕</button></li>
											{/each}
										</ul>
									{:else}
										<p class="muted small">Rituel vide — ajoute une activité.</p>
									{/if}
									<button type="button" class="add-act" onclick={() => (pickerFor = i)}>＋ ajouter une activité</button>
								</div>
							</li>
						{/each}
					</ol>
				{/if}

				<Button type="submit">{creating ? 'Enregistrement…' : editingSeanceId ? 'Enregistrer les modifications' : 'Créer la séance'}</Button>
			</form>
			{#if err}<p class="err">{err}</p>{/if}
		</Card>
	{/if}
</section>

{#if !editingSeanceId}
<section class="mine">
	<h2>Mes séances {#if mine.length}<span class="count">{mine.length}</span>{/if}</h2>
		{#if loading}
			<p class="muted">Chargement…</p>
		{:else if mine.length === 0}
			<EmptyState icon="🎬" title="Aucune séance" description="Crée ta première séance avec « ＋ Nouvelle séance »." />
		{:else}
			<ul class="list">
				{#each mine as p (p.id)}
					<li class="srow">
						<div class="srow-main">
							<span class="titre">{p.titre}</span>
							<span class="meta">{ritCount(p)} rituel{ritCount(p) > 1 ? 's' : ''}</span>
						</div>
						<div class="srow-actions">
							<select bind:value={choice[p.id]} aria-label="Classe">
								<option value="">— classe —</option>
								{#each classes as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
							</select>
							<button class="btn sm" onclick={() => assign(p.id)} disabled={!choice[p.id]}>Assigner</button>
							<button class="icon" class:on={p.is_published} aria-label="Publier comme modèle" title={p.is_published ? 'Publié — cliquer pour dépublier' : 'Publier comme modèle Maths974'} onclick={() => togglePublish(p)}>{p.is_published ? '📤' : '📥'}</button>
							<button class="icon danger" aria-label="Supprimer la séance" title="Supprimer la séance" onclick={() => del(p)}>🗑</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if templates.length}
			<h2 class="mt">Modèles Maths974</h2>
			<ul class="list">
				{#each templates as p (p.id)}
					<li class="srow">
						<div class="srow-main">
							<span class="titre">📚 {p.titre}</span>
							<span class="meta">{ritCount(p)} rituel{ritCount(p) > 1 ? 's' : ''}</span>
						</div>
						<div class="srow-actions">
							<button class="btn sm ghost" onclick={() => duplicate(p)}>Dupliquer</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{#if msg}<p class="msg">{msg}</p>{/if}
	</section>
{/if}

{#if pickerFor !== null && steps[pickerFor]}
	<ActivityPicker
		rituel={steps[pickerFor].rituel}
		onpick={(id) => addActivity(pickerFor!, id)}
		onclose={() => (pickerFor = null)}
	/>
{/if}

<style>
	.back { margin: 0 0 var(--space-2); }
	.back a { color: var(--role-accent); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
	.sub { color: var(--text-muted); margin: var(--space-2) 0 var(--space-4); }
	.sub a { color: var(--role-accent); }
	.composer { margin-bottom: var(--space-4); }
	.composer-toggle { width: 100%; text-align: left; border: 1px dashed var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.55rem 0.9rem; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
	.composer-toggle .ccaret { display: inline-block; width: 1rem; }
	.composer-toggle.open { border-style: solid; margin-bottom: var(--space-3); }
	.mine .count { font-size: 0.8rem; color: var(--text-muted); font-weight: 400; }
	h2 { font-size: 1.1rem; margin-bottom: var(--space-3); }
	.mt { margin-top: var(--space-5); }
	form { display: grid; gap: var(--space-3); }
	input, select { padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.lbl { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin: 0; }
	.palette { display: flex; flex-wrap: wrap; gap: var(--space-2); }
	.chip { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-full); padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.85rem; }
	.chip:hover { border-color: var(--role-accent); background: var(--role-accent-soft); }
	.seq { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
	.seq li { border: 1px solid var(--border); border-radius: var(--radius); background: var(--gray-50); overflow: hidden; }
	.rit-head { display: flex; align-items: center; gap: var(--space-2); padding: 0.5rem; background: var(--surface); border-bottom: 1px solid var(--border); }
	.rit-n { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--role-accent); color: #fff; font-size: 0.8rem; font-weight: 700; flex: none; }
	.rit-title { font-weight: 700; }
	.comps { display: flex; gap: 0.25rem; flex: 1; flex-wrap: wrap; }
	.comp { font-size: 0.68rem; font-weight: 700; color: var(--role-accent); background: var(--role-accent-soft); padding: 0.05rem 0.4rem; border-radius: var(--radius-full); }
	.rit-acts button { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); width: 1.7rem; height: 1.7rem; min-height: 0; cursor: pointer; }
	.rit-body { padding: 0.5rem; display: grid; gap: var(--space-2); }
	.acts { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.25rem; }
	.acts li { display: flex; justify-content: space-between; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.25rem 0.5rem; font-size: 0.88rem; }
	.acts li button { border: none; background: none; cursor: pointer; color: var(--text-muted); min-height: 0; }
	.small { font-size: 0.82rem; }
	.list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
	.srow { display: flex; align-items: center; gap: var(--space-3); padding: 0.5rem 0.7rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
	.srow-main { display: flex; align-items: baseline; gap: var(--space-2); flex: 1; min-width: 0; }
	.titre { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.meta { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; flex: none; }
	.srow-actions { display: flex; align-items: center; gap: 0.35rem; flex: none; flex-wrap: wrap; justify-content: flex-end; }
	.srow-actions select { padding: 0.3rem 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); max-width: 9rem; }
	.btn { border: 1px solid var(--role-accent); background: var(--role-accent); color: #fff; border-radius: var(--radius); padding: 0.4rem 0.9rem; font-weight: 600; cursor: pointer; }
	.btn.sm { padding: 0.32rem 0.6rem; font-size: 0.82rem; }
	.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
	.btn:disabled { opacity: 0.5; cursor: default; }
	.icon { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); width: 2rem; height: 2rem; min-height: 0; cursor: pointer; font-size: 0.95rem; display: grid; place-items: center; }
	.icon:hover { border-color: var(--role-accent); }
	.icon.on { background: var(--role-accent-soft); border-color: var(--role-accent); }
	.icon.danger:hover { border-color: var(--danger); }
	.msg { margin-top: var(--space-2); font-weight: 600; }
	.add-act { align-self: start; border: 1px dashed var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.4rem 0.8rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
	.muted { color: var(--text-muted); }
	.err { color: var(--danger); }
</style>
