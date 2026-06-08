<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	const id = $derived(page.params.id ?? '');

	type Classe = { id: string; nom: string; join_code: string | null };
	type Eleve = { student_id: string; student_alias: string | null };
	type Provisioned = { login: string; pin?: string; error?: string };
	type Attempt = {
		student_id: string;
		app: string;
		activity_id: string;
		passed: boolean;
		ts: string;
	};

	let cls = $state<Classe | null>(null);
	let eleves = $state<Eleve[]>([]);
	let recent = $state<Attempt[]>([]);
	let loading = $state(true);
	let err = $state('');

	const aliasOf = (sid: string) =>
		eleves.find((e) => e.student_id === sid)?.student_alias ?? sid.slice(0, 6);
	const when = (ts: string) => new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	let logins = $state('');
	let provisioning = $state(false);
	let provErr = $state('');
	let created = $state<Provisioned[]>([]);

	async function load() {
		loading = true;
		err = '';
		try {
			const sb = getSupabase();
			const { data: c, error: ce } = await sb
				.from('classes')
				.select('id,nom,join_code')
				.eq('id', id)
				.single();
			if (ce) throw ce;
			cls = c as Classe;
			const { data: cs, error: se } = await sb
				.from('class_students')
				.select('student_id, student_alias')
				.eq('class_id', id);
			if (se) throw se;
			eleves = (cs ?? []) as Eleve[];

			// État de la classe : tentatives récentes des élèves (RLS : le prof voit ses élèves).
			const ids = eleves.map((e) => e.student_id);
			if (ids.length) {
				const { data: at } = await sb
					.from('attempts')
					.select('student_id, app, activity_id, passed, ts')
					.in('student_id', ids)
					.order('ts', { ascending: false })
					.limit(50);
				recent = (at ?? []) as Attempt[];
			} else {
				recent = [];
			}
		} catch (e) {
			err = e instanceof Error ? e.message : JSON.stringify(e);
			console.error('[classe] load', e);
		} finally {
			loading = false;
		}
	}

	// Charge dès que l'id de route est connu (et au changement de classe).
	$effect(() => {
		if (id) load();
	});

	async function provision(e: SubmitEvent) {
		e.preventDefault();
		const list = logins
			.split(/[\s,;]+/)
			.map((s) => s.trim())
			.filter(Boolean)
			.map((login) => ({ login }));
		if (list.length === 0) return;
		provisioning = true;
		provErr = '';
		created = [];
		const { data, error } = await getSupabase().functions.invoke('provision-students', {
			body: { classId: id, students: list }
		});
		if (error) {
			provErr = "Provisionnement indisponible (Edge Function non déployée ?). Voir supabase/SETUP.md.";
		} else {
			created = (data as { created?: Provisioned[] } | null)?.created ?? [];
			logins = '';
			await load();
		}
		provisioning = false;
	}
</script>

<p class="back"><a href={`${base}/prof`}>← Mes classes</a></p>

{#if loading}
	<p class="muted">Chargement…</p>
{:else if err}
	<p class="err">{err}</p>
{:else if cls}
	<h1>{cls.nom}</h1>
	{#if cls.join_code}<p class="code">Code de classe : <strong>{cls.join_code}</strong></p>{/if}

	<div class="cols">
		<section>
			<h2>Élèves ({eleves.length})</h2>
			{#if eleves.length === 0}
				<EmptyState icon="👩‍🎓" title="Aucun élève" description="Provisionne des comptes ci-contre." />
			{:else}
				<ul class="roster">
					{#each eleves as el (el.student_id)}
						<li>{el.student_alias ?? el.student_id}</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<Card>
				<h2>Provisionner des élèves</h2>
				<p class="hint">Un identifiant par ligne. Des comptes sans e-mail sont créés ; un code secret (PIN) est généré et affiché une seule fois.</p>
				<form onsubmit={provision}>
					<textarea bind:value={logins} rows="6" placeholder="alice&#10;bob&#10;chloe"></textarea>
					<Button type="submit">{provisioning ? 'Création…' : 'Créer les comptes'}</Button>
				</form>
				{#if provErr}<p class="err">{provErr}</p>{/if}
				{#if created.length}
					<div class="pins">
						<h3>À imprimer / distribuer (affiché une seule fois)</h3>
						<table>
							<thead><tr><th>Identifiant</th><th>Code secret</th></tr></thead>
							<tbody>
								{#each created as c (c.login)}
									<tr><td>{c.login}</td><td>{c.pin ?? `⚠ ${c.error}`}</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card>
		</section>
	</div>

	<section class="etat">
		<h2>Activité de la classe <span class="cnt">({recent.length})</span></h2>
		{#if recent.length === 0}
			<EmptyState
				icon="📡"
				title="Aucune tentative pour l'instant"
				description="Quand un élève se connecte et joue une activité, ses réussites apparaissent ici."
			/>
		{:else}
			<table class="log">
				<thead><tr><th>Élève</th><th>Activité</th><th>Résultat</th><th>Quand</th></tr></thead>
				<tbody>
					{#each recent as a, i (i)}
						<tr>
							<td>{aliasOf(a.student_id)}</td>
							<td><span class="app">{a.app}</span> {a.activity_id}</td>
							<td>{a.passed ? '✅' : '❌'}</td>
							<td class="ts">{when(a.ts)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
{/if}

<style>
	.back {
		margin-bottom: var(--space-2);
	}
	.code {
		color: var(--text-muted);
		font-family: var(--font-mono);
		margin-bottom: var(--space-4);
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-5);
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: var(--space-3);
	}
	.roster {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.roster li {
		padding: 0.5rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-bottom: var(--space-3);
	}
	textarea {
		width: 100%;
		padding: 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		margin-bottom: var(--space-2);
	}
	.etat {
		margin-top: var(--space-6);
	}
	.etat .cnt {
		color: var(--text-muted);
		font-weight: 400;
	}
	.log {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	.log th,
	.log td {
		text-align: left;
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--border);
	}
	.log th {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.8rem;
	}
	.log .app {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--role-accent);
		background: var(--role-accent-soft);
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
	}
	.log .ts {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.pins {
		margin-top: var(--space-4);
	}
	.pins table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	.pins th,
	.pins td {
		text-align: left;
		padding: 0.4rem;
		border-bottom: 1px solid var(--border);
		font-family: var(--font-mono);
	}
	.err {
		color: var(--danger);
	}
	.muted {
		color: var(--text-muted);
	}
	@media (min-width: 900px) {
		.cols {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
