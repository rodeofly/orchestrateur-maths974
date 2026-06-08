<script lang="ts">
	// Établissement(s) de l'admin. Lecture/renommage via RLS (etab_member / etab_admin_all).
	// Créer un NOUVEL établissement = action super-admin (hors périmètre admin courant).
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase/client';
	import Card from '$components/ui/Card.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type Etab = { id: string; nom: string; uai: string | null };
	let etabs = $state<Etab[]>([]);
	let loading = $state(true);
	let err = $state('');
	let msg = $state('');
	let edit = $state<Record<string, string>>({});

	async function load() {
		loading = true;
		err = '';
		const { data, error } = await getSupabase().from('etablissements').select('id, nom, uai').order('nom');
		if (error) err = error.message;
		else {
			etabs = (data ?? []) as Etab[];
			edit = Object.fromEntries(etabs.map((e) => [e.id, e.nom]));
		}
		loading = false;
	}

	async function rename(e: Etab) {
		const nom = (edit[e.id] ?? '').trim();
		if (!nom || nom === e.nom) return;
		msg = '';
		const { error } = await getSupabase().from('etablissements').update({ nom }).eq('id', e.id);
		if (error) msg = '⚠ Renommage refusé.';
		else {
			msg = '✅ Établissement renommé.';
			await load();
		}
	}

	onMount(load);
</script>

<h1>Établissements</h1>
<p class="sub">Ton établissement de rattachement.</p>

{#if loading}
	<p class="muted">Chargement…</p>
{:else if err}
	<p class="err">{err}</p>
{:else if etabs.length === 0}
	<EmptyState icon="🏫" title="Aucun établissement" description="Ton compte n'est rattaché à aucun établissement." />
{:else}
	<div class="grid">
		{#each etabs as e (e.id)}
			<Card>
				<div class="row">
					<input bind:value={edit[e.id]} aria-label="Nom de l'établissement" />
					<button onclick={() => rename(e)} disabled={(edit[e.id] ?? '').trim() === e.nom}>Renommer</button>
				</div>
				{#if e.uai}<p class="uai">UAI : {e.uai}</p>{/if}
			</Card>
		{/each}
	</div>
{/if}

{#if msg}<p class="msg">{msg}</p>{/if}
<p class="note">Créer un nouvel établissement est une action super-admin (à venir).</p>

<style>
	.sub { color: var(--text-muted); margin: var(--space-2) 0 var(--space-4); }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: var(--space-4); }
	.row { display: flex; gap: var(--space-2); }
	.row input { flex: 1; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	.row button { border: 1px solid var(--role-accent); background: var(--role-accent); color: #fff; border-radius: var(--radius); padding: 0.4rem 0.9rem; font-weight: 600; cursor: pointer; }
	.row button:disabled { opacity: 0.5; cursor: default; }
	.uai { color: var(--text-muted); font-size: 0.85rem; margin-top: var(--space-2); font-family: var(--font-mono); }
	.msg { font-weight: 600; margin-top: var(--space-3); }
	.note { color: var(--text-muted); font-size: 0.85rem; margin-top: var(--space-4); }
	.muted { color: var(--text-muted); }
	.err { color: var(--danger); }
</style>
