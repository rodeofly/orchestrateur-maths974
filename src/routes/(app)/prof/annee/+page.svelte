<script lang="ts">
	// Planification annuelle — la FRISE : Année → Périodes (positionnées en semaines) →
	// Séquences → Séances (= parcours). Le prof voit sa progression « all-at-once » et
	// organise tout par CRUD. RLS : author_id = auth.uid() (cf. 0007_planification).
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';

	type Annee = { id: string; label: string; date_debut: string | null; term_system: 'trimestre' | 'semestre'; nb_semaines: number };
	type Periode = { id: string; annee_id: string; label: string; ordre: number; term: number; semaine_debut: number | null; semaine_fin: number | null; couleur: string | null };
	type Sequence = { id: string; periode_id: string; titre: string; ordre: number };
	type Seance = { id: string; titre: string; sequence_id: string | null; ordre: number };

	let annees = $state<Annee[]>([]);
	let selId = $state<string>('');
	let periodes = $state<Periode[]>([]);
	let sequences = $state<Sequence[]>([]);
	let seances = $state<Seance[]>([]);
	let loading = $state(true);
	let err = $state('');

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

	async function loadAnnees() {
		loading = true; err = '';
		const { data, error } = await sb().from('annees_scolaires').select('id,label,date_debut,term_system,nb_semaines').order('created_at', { ascending: false });
		if (error) err = error.message;
		annees = (data ?? []) as Annee[];
		if (annees.length && !selId) selId = annees[0].id;
		loading = false;
	}
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
		if (!newLabel.trim()) return;
		creating = true; err = '';
		const nb = 32, nP = 5, nbTerms = newSystem === 'semestre' ? 2 : 3;
		const { data: a, error } = await sb().from('annees_scolaires').insert({
			author_id: session.userId, etablissement_id: session.tenantId ?? null,
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

	loadAnnees();
</script>

<div class="head">
	<h1>Progression annuelle</h1>
	{#if annees.length}
		<select bind:value={selId} aria-label="Année">
			{#each annees as a (a.id)}<option value={a.id}>{a.label} · {a.term_system}</option>{/each}
		</select>
	{/if}
	<button class="new" onclick={() => (creating = !creating)}>＋ Nouvelle année</button>
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

{#if err}<p class="err">⚠ {err}</p>{/if}

{#if loading}
	<p class="muted">Chargement…</p>
{:else if !annee}
	<p class="muted">Aucune année. Crée ta première progression — elle arrivera pré-remplie, à ajuster.</p>
{:else}
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
	<p class="hint">Glisse la barre horizontalement pour parcourir l'année. Clique une séance pour éditer ses rituels (dans Séances).</p>
{/if}

<style>
	.head { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
	.head select { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.new { margin-left: auto; border: 1px solid var(--role-accent); background: var(--role-accent-soft); color: var(--role-accent); border-radius: var(--radius); padding: 0.45rem 0.9rem; font-weight: 700; cursor: pointer; }
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
</style>
