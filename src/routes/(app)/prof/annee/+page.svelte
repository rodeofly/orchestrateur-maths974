<script lang="ts">
	// Planification annuelle — la FRISE : Année → Périodes (positionnées en semaines) →
	// Séquences → Séances (= parcours). Le prof voit sa progression « all-at-once » et
	// organise tout par CRUD. RLS : author_id = auth.uid() (cf. 0007_planification).
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';

	type Annee = { id: string; label: string; date_debut: string | null; term_system: 'trimestre' | 'semestre'; nb_semaines: number };
	type Periode = { id: string; annee_id: string; label: string; ordre: number; term: number; semaine_debut: number | null; semaine_fin: number | null; couleur: string | null };
	type Sequence = { id: string; periode_id: string; titre: string; ordre: number };
	type Seance = { id: string; titre: string; sequence_id: string | null; ordre: number };

	type Classe = { id: string; nom: string };
	let classes = $state<Classe[]>([]);
	let classId = $state<string>('');
	const cls = $derived(classes.find((c) => c.id === classId) ?? null);

	let annees = $state<Annee[]>([]);
	let selId = $state<string>('');
	let periodes = $state<Periode[]>([]);
	let sequences = $state<Sequence[]>([]);
	let seances = $state<Seance[]>([]);
	let loading = $state(true);
	let err = $state('');

	// Duplication de la progression vers une autre classe.
	let dupTo = $state('');
	let dupBusy = $state(false);
	let dupMsg = $state('');

	const sb = () => getSupabase();
	const annee = $derived(annees.find((a) => a.id === selId) ?? null);
	const W = 46; // px par semaine (largeur de la frise)
	const HUES = [215, 175, 275, 30, 140, 245, 340];

	const termLabel = (a: Annee | null, t: number) => `${a?.term_system === 'semestre' ? 'Semestre' : 'Trimestre'} ${t}`;
	const seqOf = (pid: string) => sequences.filter((s) => s.periode_id === pid).sort((a, b) => a.ordre - b.ordre);
	const seaOf = (sid: string) => seances.filter((s) => s.sequence_id === sid).sort((a, b) => a.ordre - b.ordre);

	// Groupes de termes (trimestres/semestres) = périodes consécutives de même `term`.
	const termGroups = $derived.by(() => {
		const ps = [...periodes].sort((a, b) => a.ordre - b.ordre);
		const groups: { term: number; sd: number; sf: number }[] = [];
		for (const p of ps) {
			const sd = p.semaine_debut ?? 1, sf = p.semaine_fin ?? sd;
			const last = groups[groups.length - 1];
			if (last && last.term === p.term) last.sf = Math.max(last.sf, sf);
			else groups.push({ term: p.term, sd, sf });
		}
		return groups;
	});

	async function loadClasses() {
		const { data } = await sb().from('classes').select('id,nom').order('created_at');
		classes = (data ?? []) as Classe[];
		const wanted = page.url.searchParams.get('class');
		classId = wanted && classes.some((c) => c.id === wanted) ? wanted : (classes[0]?.id ?? '');
		loading = false;
	}
	async function loadAnnees(cid: string) {
		if (!cid) { annees = []; selId = ''; return; }
		const { data, error } = await sb().from('annees_scolaires').select('id,label,date_debut,term_system,nb_semaines').eq('class_id', cid).order('created_at', { ascending: false });
		if (error) err = error.message;
		annees = (data ?? []) as Annee[];
		selId = annees[0]?.id ?? '';
	}
	$effect(() => { if (classId) loadAnnees(classId); });
	async function loadPlan(id: string) {
		if (!id) { periodes = []; sequences = []; seances = []; return; }
		const { data: ps } = await sb().from('periodes').select('id,annee_id,label,ordre,term,semaine_debut,semaine_fin,couleur').eq('annee_id', id);
		periodes = (ps ?? []) as Periode[];
		const pids = periodes.map((p) => p.id);
		const { data: sq } = pids.length ? await sb().from('sequences').select('id,periode_id,titre,ordre').in('periode_id', pids) : { data: [] };
		sequences = (sq ?? []) as Sequence[];
		const sids = sequences.map((s) => s.id);
		const { data: se } = sids.length ? await sb().from('parcours').select('id,titre,sequence_id,ordre').in('sequence_id', sids) : { data: [] };
		seances = (se ?? []) as Seance[];
	}
	$effect(() => { loadPlan(selId); });

	// ── Création d'année + structure pré-remplie (5 périodes sur nb_semaines) ──
	let creating = $state(false);
	let newLabel = $state('');
	let newDebut = $state('');
	let newSystem = $state<'trimestre' | 'semestre'>('trimestre');

	function weekSizes(total: number, n: number): number[] {
		const base = Math.floor(total / n), rem = total - base * n;
		return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
	}
	async function createAnnee() {
		if (!newLabel.trim() || !classId) return;
		creating = true; err = '';
		const nb = 32, nP = 5, nbTerms = newSystem === 'semestre' ? 2 : 3;
		const { data: a, error } = await sb().from('annees_scolaires').insert({
			author_id: session.userId, etablissement_id: session.tenantId ?? null, class_id: classId,
			label: newLabel.trim(), date_debut: newDebut || null, term_system: newSystem, nb_semaines: nb
		}).select('id,label,date_debut,term_system,nb_semaines').single();
		if (error || !a) { err = error?.message ?? 'création échouée'; creating = false; return; }
		const sizes = weekSizes(nb, nP);
		let cursor = 1;
		const rows = sizes.map((sz, i) => {
			const sd = cursor, sf = cursor + sz - 1; cursor += sz;
			let dd: string | null = null, df: string | null = null;
			if (newDebut) {
				const start = new Date(newDebut); start.setDate(start.getDate() + (sd - 1) * 7);
				const end = new Date(newDebut); end.setDate(end.getDate() + sf * 7 - 1);
				dd = start.toISOString().slice(0, 10); df = end.toISOString().slice(0, 10);
			}
			return {
				annee_id: a.id, author_id: session.userId, label: `Période ${i + 1}`, ordre: i,
				term: Math.floor((i * nbTerms) / nP) + 1, semaine_debut: sd, semaine_fin: sf,
				date_debut: dd, date_fin: df, couleur: String(HUES[i % HUES.length])
			};
		});
		await sb().from('periodes').insert(rows);
		annees = [a as Annee, ...annees]; selId = a.id; creating = false; newLabel = ''; newDebut = '';
	}

	// ── CRUD ──
	async function addPeriode() {
		if (!annee) return;
		const last = [...periodes].sort((a, b) => a.ordre - b.ordre).at(-1);
		const sd = (last?.semaine_fin ?? 0) + 1, sf = Math.min(sd + 5, annee.nb_semaines);
		const ordre = periodes.length;
		const { data } = await sb().from('periodes').insert({
			annee_id: annee.id, author_id: session.userId, label: `Période ${ordre + 1}`, ordre,
			term: (last?.term ?? 1), semaine_debut: sd, semaine_fin: sf, couleur: String(HUES[ordre % HUES.length])
		}).select('id,annee_id,label,ordre,term,semaine_debut,semaine_fin,couleur').single();
		if (data) periodes = [...periodes, data as Periode];
	}
	async function renamePeriode(p: Periode, label: string) {
		const t = label.trim(); if (!t || t === p.label) return;
		await sb().from('periodes').update({ label: t }).eq('id', p.id);
		periodes = periodes.map((x) => (x.id === p.id ? { ...x, label: t } : x));
	}
	async function delPeriode(p: Periode) {
		if (!confirm(`Supprimer « ${p.label} » et tout ce qu'elle contient ?`)) return;
		await sb().from('periodes').delete().eq('id', p.id);
		periodes = periodes.filter((x) => x.id !== p.id);
		sequences = sequences.filter((s) => s.periode_id !== p.id);
	}
	async function addSequence(pid: string) {
		const ordre = seqOf(pid).length;
		const { data } = await sb().from('sequences').insert({
			periode_id: pid, author_id: session.userId, titre: 'Nouvelle séquence', ordre
		}).select('id,periode_id,titre,ordre').single();
		if (data) sequences = [...sequences, data as Sequence];
	}
	async function renameSequence(s: Sequence, titre: string) {
		const t = titre.trim(); if (!t || t === s.titre) return;
		await sb().from('sequences').update({ titre: t }).eq('id', s.id);
		sequences = sequences.map((x) => (x.id === s.id ? { ...x, titre: t } : x));
	}
	async function delSequence(s: Sequence) {
		if (!confirm(`Supprimer la séquence « ${s.titre} » ?`)) return;
		await sb().from('sequences').delete().eq('id', s.id);
		sequences = sequences.filter((x) => x.id !== s.id);
	}
	async function addSeance(sid: string) {
		const ordre = seaOf(sid).length;
		const { data } = await sb().from('parcours').insert({
			author_id: session.userId, etablissement_id: session.tenantId ?? null,
			titre: 'Nouvelle séance', steps: [], sequence_id: sid, ordre
		}).select('id,titre,sequence_id,ordre').single();
		if (data) seances = [...seances, data as Seance];
	}
	async function delSeance(s: Seance) {
		if (!confirm(`Supprimer la séance « ${s.titre} » ?`)) return;
		await sb().from('parcours').delete().eq('id', s.id);
		seances = seances.filter((x) => x.id !== s.id);
	}

	// ── Vue ARBORESCENCE (édition inline + drag & drop) ──
	let viewMode = $state<'frise' | 'arbre'>('arbre');
	let collapsed = $state<Set<string>>(new Set());
	let editingId = $state<string | null>(null);
	const toggleCol = (id: string) => { const n = new Set(collapsed); n.has(id) ? n.delete(id) : n.add(id); collapsed = n; };
	const focusEl = (node: HTMLInputElement) => { node.focus(); node.select(); };

	async function renameSeance(s: Seance, titre: string) {
		const t = titre.trim(); if (!t || t === s.titre) return;
		await sb().from('parcours').update({ titre: t }).eq('id', s.id);
		seances = seances.map((x) => (x.id === s.id ? { ...x, titre: t } : x));
	}

	type Drag = { kind: 'periode' | 'sequence' | 'seance'; id: string };
	let drag = $state<Drag | null>(null);
	let overId = $state<string | null>(null);
	const reset = () => { drag = null; overId = null; };
	function onDragStart(kind: Drag['kind'], id: string, e: DragEvent) {
		drag = { kind, id };
		if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }
	}
	function allowDrop(e: DragEvent, id: string, kinds: Drag['kind'][]) {
		if (drag && kinds.includes(drag.kind)) { e.preventDefault(); e.stopPropagation(); overId = id; }
	}
	async function persistRows(table: 'periodes' | 'sequences' | 'parcours', rows: Record<string, unknown>[]) {
		for (const r of rows) { const { id, ...rest } = r; await sb().from(table).update(rest).eq('id', id as string); }
	}

	// Séance déposée : dans `targetSeq`, juste avant `beforeId` (ou à la fin). Réordonne OU déplace.
	async function moveSeance(targetSeq: string, beforeId: string | null) {
		if (!drag || drag.kind !== 'seance' || drag.id === beforeId) return reset();
		const dragged = seances.find((s) => s.id === drag!.id); if (!dragged) return reset();
		const target = seances.filter((s) => s.sequence_id === targetSeq && s.id !== dragged.id).sort((a, b) => a.ordre - b.ordre);
		const at = beforeId ? Math.max(0, target.findIndex((s) => s.id === beforeId)) : target.length;
		target.splice(at, 0, { ...dragged, sequence_id: targetSeq });
		const reord = target.map((s, i) => ({ ...s, ordre: i }));
		seances = seances.map((s) => reord.find((r) => r.id === s.id) ?? s);
		await persistRows('parcours', reord.map((s) => ({ id: s.id, ordre: s.ordre, sequence_id: s.sequence_id })));
		reset();
	}
	async function moveSequence(targetPer: string, beforeId: string | null) {
		if (!drag || drag.kind !== 'sequence' || drag.id === beforeId) return reset();
		const dragged = sequences.find((s) => s.id === drag!.id); if (!dragged) return reset();
		const target = sequences.filter((s) => s.periode_id === targetPer && s.id !== dragged.id).sort((a, b) => a.ordre - b.ordre);
		const at = beforeId ? Math.max(0, target.findIndex((s) => s.id === beforeId)) : target.length;
		target.splice(at, 0, { ...dragged, periode_id: targetPer });
		const reord = target.map((s, i) => ({ ...s, ordre: i }));
		sequences = sequences.map((s) => reord.find((r) => r.id === s.id) ?? s);
		await persistRows('sequences', reord.map((s) => ({ id: s.id, ordre: s.ordre, periode_id: s.periode_id })));
		reset();
	}
	// Période réordonnée : recalcule les semaines (préserve la durée de chaque période).
	async function movePeriode(beforeId: string | null) {
		if (!drag || drag.kind !== 'periode' || drag.id === beforeId) return reset();
		let list = [...periodes].sort((a, b) => a.ordre - b.ordre);
		const dragged = list.find((p) => p.id === drag!.id); if (!dragged) return reset();
		list = list.filter((p) => p.id !== dragged.id);
		const at = beforeId ? Math.max(0, list.findIndex((p) => p.id === beforeId)) : list.length;
		list.splice(at, 0, dragged);
		let cursor = 1;
		const reord = list.map((p, i) => {
			const span = Math.max(1, (p.semaine_fin ?? p.semaine_debut ?? 1) - (p.semaine_debut ?? 1) + 1);
			const sd = cursor, sf = cursor + span - 1; cursor += span;
			return { ...p, ordre: i, semaine_debut: sd, semaine_fin: sf };
		});
		periodes = reord;
		await persistRows('periodes', reord.map((p) => ({ id: p.id, ordre: p.ordre, semaine_debut: p.semaine_debut, semaine_fin: p.semaine_fin })));
		reset();
	}

	// Duplication PROFONDE de la progression courante vers une autre classe (option A : on
	// clone année → périodes → séquences → séances). Mapping par (parent, ordre), robuste
	// quel que soit l'ordre de retour des inserts.
	async function duplicateProgression() {
		if (!annee || !dupTo || dupTo === classId) return;
		dupBusy = true; dupMsg = ''; err = '';
		try {
			const { data: na, error: e1 } = await sb().from('annees_scolaires').insert({
				author_id: session.userId, etablissement_id: session.tenantId ?? null, class_id: dupTo,
				label: annee.label, date_debut: annee.date_debut, term_system: annee.term_system, nb_semaines: annee.nb_semaines
			}).select('id').single();
			if (e1 || !na) throw e1 ?? new Error('année');

			const srcPer = [...periodes].sort((a, b) => a.ordre - b.ordre);
			const oldToNewPer = new Map<string, string>();
			if (srcPer.length) {
				const { data: np } = await sb().from('periodes').insert(
					srcPer.map((p) => ({ annee_id: na.id, author_id: session.userId, label: p.label, ordre: p.ordre, term: p.term, semaine_debut: p.semaine_debut, semaine_fin: p.semaine_fin, couleur: p.couleur }))
				).select('id,ordre');
				const byOrdre = new Map<number, string>((np ?? []).map((x: { id: string; ordre: number }) => [x.ordre, x.id]));
				srcPer.forEach((p) => { const id = byOrdre.get(p.ordre); if (id) oldToNewPer.set(p.id, id); });
			}

			const oldToNewSeq = new Map<string, string>();
			if (sequences.length) {
				const { data: ns } = await sb().from('sequences').insert(
					sequences.map((s) => ({ periode_id: oldToNewPer.get(s.periode_id), author_id: session.userId, titre: s.titre, ordre: s.ordre }))
				).select('id,periode_id,ordre');
				const key = (pid: string, o: number) => `${pid}:${o}`;
				const byKey = new Map<string, string>((ns ?? []).map((x: { id: string; periode_id: string; ordre: number }) => [key(x.periode_id, x.ordre), x.id]));
				sequences.forEach((s) => { const np = oldToNewPer.get(s.periode_id); if (np) { const id = byKey.get(key(np, s.ordre)); if (id) oldToNewSeq.set(s.id, id); } });
			}

			// Séances : on récupère leurs steps (rituels) pour les cloner intégralement.
			const srcIds = seances.filter((s) => s.sequence_id && oldToNewSeq.has(s.sequence_id)).map((s) => s.id);
			if (srcIds.length) {
				const { data: full } = await sb().from('parcours').select('id,titre,steps,sequence_id,ordre').in('id', srcIds);
				const rows = (full ?? []).map((s: { titre: string; steps: unknown; sequence_id: string; ordre: number }) => ({
					author_id: session.userId, etablissement_id: session.tenantId ?? null,
					titre: s.titre, steps: s.steps, sequence_id: oldToNewSeq.get(s.sequence_id), ordre: s.ordre, is_published: false
				}));
				if (rows.length) await sb().from('parcours').insert(rows);
			}

			const target = classes.find((c) => c.id === dupTo);
			dupMsg = `✅ Progression copiée vers « ${target?.nom ?? 'la classe'} ».`;
			dupTo = '';
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			dupBusy = false;
		}
	}

	loadClasses();
</script>

<div class="head">
	<h1>Progression</h1>
	{#if classes.length}
		<select class="cls" bind:value={classId} aria-label="Classe">
			{#each classes as c (c.id)}<option value={c.id}>🏫 {c.nom}</option>{/each}
		</select>
	{/if}
	{#if annees.length > 1}
		<select bind:value={selId} aria-label="Année">
			{#each annees as a (a.id)}<option value={a.id}>{a.label}</option>{/each}
		</select>
	{/if}
	{#if classId}<button class="new" onclick={() => (creating = !creating)}>＋ Nouvelle année</button>{/if}
</div>

{#if creating}
	<form class="create" onsubmit={(e) => { e.preventDefault(); createAnnee(); }}>
		<input bind:value={newLabel} placeholder="Libellé (ex 2025–2026)" aria-label="Libellé" />
		<label>Début <input type="date" bind:value={newDebut} /></label>
		<label>Découpage
			<select bind:value={newSystem}><option value="trimestre">Trimestres (3)</option><option value="semestre">Semestres (2)</option></select>
		</label>
		<button class="primary" disabled={!newLabel.trim()}>Créer (32 sem. + 5 périodes)</button>
	</form>
{/if}

{#if annee && classes.length > 1}
	<div class="dupbar">
		<span class="dl">Dupliquer cette progression vers&nbsp;:</span>
		<select bind:value={dupTo} aria-label="Classe cible">
			<option value="">— une autre classe —</option>
			{#each classes.filter((c) => c.id !== classId) as c (c.id)}<option value={c.id}>{c.nom}</option>{/each}
		</select>
		<button class="dup" disabled={!dupTo || dupBusy} onclick={duplicateProgression}>{dupBusy ? 'Copie…' : '⧉ Dupliquer'}</button>
		{#if dupMsg}<span class="dupmsg">{dupMsg}</span>{/if}
	</div>
{/if}

{#if err}<p class="err">⚠ {err}</p>{/if}

{#if loading}
	<p class="muted">Chargement…</p>
{:else if !classes.length}
	<p class="muted">Tu n'as pas encore de classe. Crée-en une dans <a href={`${base}/prof`}>Mes classes</a>, puis reviens organiser sa progression.</p>
{:else if !annee}
	<p class="muted">La classe <strong>{cls?.nom}</strong> n'a pas encore de progression. Clique <strong>＋ Nouvelle année</strong> — elle arrivera pré-remplie, à ajuster.</p>
{:else}
	<div class="viewtabs">
		<button class:on={viewMode === 'arbre'} onclick={() => (viewMode = 'arbre')}>🌳 Arborescence</button>
		<button class:on={viewMode === 'frise'} onclick={() => (viewMode = 'frise')}>📅 Frise</button>
	</div>
	{#if viewMode === 'frise'}
	<div class="frise" style="--w:{W}px; width:{annee.nb_semaines * W + 2}px">
		<!-- Bandeau trimestres/semestres -->
		<div class="terms" style="height:1.6rem">
			{#each termGroups as g (g.term + '-' + g.sd)}
				<span class="term" style="left:{(g.sd - 1) * W}px; width:{(g.sf - g.sd + 1) * W}px">{termLabel(annee, g.term)}</span>
			{/each}
		</div>
		<!-- Règle des semaines -->
		<div class="ruler">
			{#each Array(annee.nb_semaines) as _, i (i)}<span class="wk" style="left:{i * W}px; width:{W}px">{i + 1}</span>{/each}
		</div>
		<!-- Bandes de périodes -->
		<div class="bands">
			{#each [...periodes].sort((a, b) => a.ordre - b.ordre) as p (p.id)}
				{@const sd = p.semaine_debut ?? 1}
				{@const sf = p.semaine_fin ?? sd}
				<section class="band" style="left:{(sd - 1) * W}px; width:{(sf - sd + 1) * W}px; --h:{p.couleur ?? 215}">
					<header>
						<input class="plabel" value={p.label} onblur={(e) => renamePeriode(p, e.currentTarget.value)} />
						<button class="x" title="Supprimer la période" onclick={() => delPeriode(p)}>✕</button>
					</header>
					<div class="seqs">
						{#each seqOf(p.id) as s (s.id)}
							<div class="seq">
								<div class="seq-h">
									<input class="slabel" value={s.titre} onblur={(e) => renameSequence(s, e.currentTarget.value)} />
									<button class="x" title="Supprimer la séquence" onclick={() => delSequence(s)}>✕</button>
								</div>
								<div class="seances">
									{#each seaOf(s.id) as sa (sa.id)}
										<span class="seance">
											<a href={`${base}/prof/parcours`} title="Éditer la séance">🎬 {sa.titre}</a>
											<button class="x sm" title="Supprimer" onclick={() => delSeance(sa)}>✕</button>
										</span>
									{/each}
									<button class="add-sea" onclick={() => addSeance(s.id)}>＋ séance</button>
								</div>
							</div>
						{/each}
						<button class="add-seq" onclick={() => addSequence(p.id)}>＋ séquence</button>
					</div>
				</section>
			{/each}
			<button class="add-per" onclick={addPeriode} title="Ajouter une période">＋</button>
		</div>
	</div>
	<p class="hint">Glisse la barre horizontalement pour parcourir l'année.</p>
	{:else}
	<!-- ARBORESCENCE éditable (drag & drop) -->
	<div class="arbre" role="tree" aria-label="Progression annuelle">
		{#each [...periodes].sort((a, b) => a.ordre - b.ordre) as p (p.id)}
			<div class="node periode" role="treeitem" aria-selected="false" aria-label={p.label} tabindex="-1" class:over={overId === p.id} style="--h:{p.couleur ?? 215}"
				draggable={editingId !== p.id}
				ondragstart={(e) => onDragStart('periode', p.id, e)}
				ondragover={(e) => allowDrop(e, p.id, ['periode', 'sequence'])}
				ondragleave={() => (overId = null)}
				ondrop={() => (drag?.kind === 'sequence' ? moveSequence(p.id, null) : movePeriode(p.id))}>
				<div class="row">
					<span class="grip" title="Glisser pour réordonner">⠿</span>
					<button class="caret" onclick={() => toggleCol(p.id)} aria-label="Plier/déplier">{collapsed.has(p.id) ? '▸' : '▾'}</button>
					<span class="dot"></span>
					{#if editingId === p.id}
						<input class="edit" value={p.label} use:focusEl onblur={(e) => { renamePeriode(p, e.currentTarget.value); editingId = null; }} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
					{:else}
						<span class="lbl">{p.label}</span>
					{/if}
					<span class="badge">{termLabel(annee, p.term)} · S{p.semaine_debut}–{p.semaine_fin}</span>
					<span class="acts">
						<button class="ic" title="Renommer" onclick={() => (editingId = p.id)}>✏️</button>
						<button class="ic" title="Ajouter une séquence" onclick={() => addSequence(p.id)}>➕</button>
						<button class="ic danger" title="Supprimer" onclick={() => delPeriode(p)}>🗑</button>
					</span>
				</div>
				{#if !collapsed.has(p.id)}
					<div class="children">
						{#each seqOf(p.id) as s (s.id)}
							<div class="node sequence" role="treeitem" aria-selected="false" aria-label={s.titre} tabindex="-1" class:over={overId === s.id}
								draggable={editingId !== s.id}
								ondragstart={(e) => { e.stopPropagation(); onDragStart('sequence', s.id, e); }}
								ondragover={(e) => allowDrop(e, s.id, ['sequence', 'seance'])}
								ondragleave={() => (overId = null)}
								ondrop={(e) => { e.stopPropagation(); drag?.kind === 'seance' ? moveSeance(s.id, null) : moveSequence(p.id, s.id); }}>
								<div class="row">
									<span class="grip" title="Glisser">⠿</span>
									<button class="caret" onclick={() => toggleCol(s.id)} aria-label="Plier/déplier">{collapsed.has(s.id) ? '▸' : '▾'}</button>
									{#if editingId === s.id}
										<input class="edit" value={s.titre} use:focusEl onblur={(e) => { renameSequence(s, e.currentTarget.value); editingId = null; }} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
									{:else}
										<span class="lbl seq">{s.titre}</span>
									{/if}
									<span class="acts">
										<button class="ic" title="Renommer" onclick={() => (editingId = s.id)}>✏️</button>
										<button class="ic" title="Ajouter une séance" onclick={() => addSeance(s.id)}>➕</button>
										<button class="ic danger" title="Supprimer" onclick={() => delSequence(s)}>🗑</button>
									</span>
								</div>
								{#if !collapsed.has(s.id)}
									<div class="children">
										{#each seaOf(s.id) as sa (sa.id)}
											<div class="node seance" role="treeitem" aria-selected="false" aria-label={sa.titre} tabindex="-1" class:over={overId === sa.id}
												draggable={editingId !== sa.id}
												ondragstart={(e) => { e.stopPropagation(); onDragStart('seance', sa.id, e); }}
												ondragover={(e) => allowDrop(e, sa.id, ['seance'])}
												ondragleave={() => (overId = null)}
												ondrop={(e) => { e.stopPropagation(); moveSeance(s.id, sa.id); }}>
												<div class="row">
													<span class="grip" title="Glisser">⠿</span>
													<span class="lead">🎬</span>
													{#if editingId === sa.id}
														<input class="edit" value={sa.titre} use:focusEl onblur={(e) => { renameSeance(sa, e.currentTarget.value); editingId = null; }} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
													{:else}
														<span class="lbl">{sa.titre}</span>
													{/if}
													<span class="acts">
														<button class="ic" title="Renommer" onclick={() => (editingId = sa.id)}>✏️</button>
														<a class="ic" title="Éditer les rituels" href={`${base}/prof/parcours?edit=${sa.id}`}>🔧</a>
														<button class="ic danger" title="Supprimer" onclick={() => delSeance(sa)}>🗑</button>
													</span>
												</div>
											</div>
										{/each}
										{#if seaOf(s.id).length === 0}<p class="empty-c">Glisse une séance ici, ou ➕</p>{/if}
									</div>
								{/if}
							</div>
						{/each}
						{#if seqOf(p.id).length === 0}<p class="empty-c">Aucune séquence — ➕ pour en ajouter</p>{/if}
					</div>
				{/if}
			</div>
		{/each}
		<button class="add-per-row" onclick={addPeriode}>➕ Ajouter une période</button>
	</div>
	<p class="hint">Glisse ⠿ pour réordonner ou déplacer (séance entre séquences, séquence entre périodes). ✏️ renomme, 🔧 édite les rituels.</p>
	{/if}
{/if}

<style>
	.head { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
	.head select { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.head .cls { font-weight: 700; }
	.new { margin-left: auto; border: 1px solid var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.45rem 0.9rem; font-weight: 700; cursor: pointer; }
	.dupbar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin: var(--space-3) 0; padding: 0.5rem 0.7rem; background: var(--gray-50); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; }
	.dupbar .dl { color: var(--text-muted); font-weight: 600; }
	.dupbar select { padding: 0.3rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.dup { border: 1px solid var(--role-accent); background: var(--role-accent); color: #fff; border-radius: var(--radius); padding: 0.35rem 0.8rem; font-weight: 700; cursor: pointer; }
	.dup:disabled { opacity: 0.5; cursor: not-allowed; }
	.dupmsg { color: var(--success); font-weight: 600; }
	.create { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: end; margin: var(--space-3) 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
	.create input, .create select { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.create label { display: grid; gap: 0.2rem; font-size: 0.78rem; color: var(--text-muted); }
	.primary { border: 1px solid var(--role-accent); background: var(--role-accent); color: #fff; border-radius: var(--radius); padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; }
	.primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.muted { color: var(--text-muted); padding: var(--space-5) 0; }
	.err { color: var(--danger); }
	.hint { color: var(--text-muted); font-size: 0.82rem; margin-top: var(--space-3); }

	.frise { position: relative; overflow-x: auto; margin-top: var(--space-4); padding-bottom: var(--space-3); }
	.terms { position: relative; }
	.term { position: absolute; top: 0; height: 1.3rem; background: var(--gray-900); color: #fff; font-size: 0.72rem; font-weight: 700; border-radius: var(--radius-full); display: grid; place-items: center; box-sizing: border-box; border: 2px solid var(--surface); }
	.ruler { position: relative; height: 1.4rem; margin: 0.2rem 0; }
	.wk { position: absolute; top: 0; font-size: 0.62rem; color: var(--text-muted); text-align: center; box-sizing: border-box; border-left: 1px solid var(--border); }
	.bands { position: relative; min-height: 8rem; }
	.band { position: absolute; top: 0; box-sizing: border-box; background: hsl(var(--h) 70% 97%); border: 1px solid hsl(var(--h) 60% 80%); border-top: 3px solid hsl(var(--h) 60% 55%); border-radius: var(--radius); padding: 0.3rem; display: grid; gap: 0.3rem; align-content: start; }
	.band header { display: flex; align-items: center; gap: 0.2rem; }
	.plabel { flex: 1; min-width: 0; font-weight: 700; font-size: 0.82rem; border: none; background: transparent; color: hsl(var(--h) 55% 32%); border-radius: var(--radius); padding: 0.1rem 0.2rem; }
	.plabel:focus { background: #fff; outline: 1px solid hsl(var(--h) 60% 70%); }
	.seqs { display: grid; gap: 0.3rem; }
	.seq { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.3rem; }
	.seq-h { display: flex; align-items: center; gap: 0.2rem; }
	.slabel { flex: 1; min-width: 0; font-weight: 600; font-size: 0.78rem; border: none; background: transparent; border-radius: var(--radius); padding: 0.1rem 0.2rem; }
	.slabel:focus { background: var(--gray-50); outline: 1px solid var(--border); }
	.seances { display: grid; gap: 0.2rem; margin-top: 0.2rem; }
	.seance { display: flex; align-items: center; gap: 0.2rem; font-size: 0.74rem; }
	.seance a { flex: 1; min-width: 0; color: var(--text); text-decoration: none; background: var(--gray-50); border-radius: var(--radius); padding: 0.15rem 0.35rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.seance a:hover { background: var(--role-accent-soft); color: var(--role-accent); }
	.x { border: none; background: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; padding: 0 0.15rem; line-height: 1; }
	.x:hover { color: var(--danger); }
	.x.sm { font-size: 0.7rem; }
	.add-sea, .add-seq { border: 1px dashed var(--border); background: transparent; color: var(--text-muted); border-radius: var(--radius); padding: 0.2rem 0.4rem; font-size: 0.72rem; cursor: pointer; text-align: left; }
	.add-seq { border-color: hsl(var(--h) 50% 70%); color: hsl(var(--h) 50% 40%); }
	.add-per { position: absolute; top: 0; left: 100%; margin-left: 0.4rem; width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 1px dashed var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); font-size: 1.2rem; cursor: pointer; }

	/* ── Vue arborescence ── */
	.viewtabs { display: inline-flex; gap: 0.2rem; margin: var(--space-4) 0 var(--space-3); background: var(--gray-100); border-radius: var(--radius-full); padding: 0.2rem; }
	.viewtabs button { border: none; background: transparent; border-radius: var(--radius-full); padding: 0.35rem 0.9rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
	.viewtabs button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
	.arbre { display: grid; gap: 0.3rem; max-width: 52rem; }
	.node { border-radius: var(--radius); }
	.node.over > .row { outline: 2px dashed var(--role-accent); outline-offset: -2px; border-radius: var(--radius); }
	.row { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.4rem; border-radius: var(--radius); }
	.periode > .row { background: hsl(var(--h) 70% 96%); border: 1px solid hsl(var(--h) 60% 82%); border-left: 3px solid hsl(var(--h) 60% 55%); }
	.sequence > .row { background: var(--surface); border: 1px solid var(--border); }
	.seance > .row { background: var(--gray-50); border: 1px solid var(--border); }
	.grip { cursor: grab; color: var(--text-muted); font-size: 0.95rem; user-select: none; }
	.caret { border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 0.8rem; width: 1rem; padding: 0; }
	.dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: hsl(var(--h) 60% 55%); flex: none; }
	.lead { font-size: 0.95rem; }
	.lbl { flex: 1; min-width: 0; font-weight: 600; font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.periode .lbl { color: hsl(var(--h) 55% 32%); font-weight: 800; }
	.lbl.seq { font-weight: 700; }
	.seance .lbl { font-weight: 500; }
	.edit { flex: 1; min-width: 0; font-size: 0.86rem; padding: 0.15rem 0.3rem; border: 1px solid var(--role-accent); border-radius: var(--radius); }
	.badge { font-size: 0.68rem; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 0.05rem 0.45rem; white-space: nowrap; }
	.acts { display: flex; align-items: center; gap: 0.1rem; flex: none; }
	.ic { display: inline-flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; font-size: 0.82rem; padding: 0.15rem 0.25rem; border-radius: var(--radius-sm); text-decoration: none; line-height: 1; }
	.ic:hover { background: var(--gray-100); }
	.ic.danger:hover { background: var(--gray-100); color: var(--danger); }
	.children { margin-left: 1.3rem; padding-left: 0.5rem; border-left: 1px solid var(--border); display: grid; gap: 0.25rem; margin-top: 0.25rem; }
	.empty-c { color: var(--text-muted); font-size: 0.76rem; font-style: italic; padding: 0.2rem 0.3rem; margin: 0; }
	.add-per-row { justify-self: start; border: 1px dashed var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.35rem 0.8rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; margin-top: 0.3rem; }
</style>
