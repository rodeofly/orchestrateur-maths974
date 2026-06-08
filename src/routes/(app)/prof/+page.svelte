<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';
	import Button from '$components/ui/Button.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type Classe = { id: string; nom: string; join_code: string | null };
	let classes = $state<Classe[]>([]);
	let loading = $state(true);
	let err = $state('');
	let nom = $state('');
	let creating = $state(false);

	function genCode(): string {
		const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
		return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
	}

	async function load() {
		loading = true;
		err = '';
		const { data, error } = await getSupabase()
			.from('classes')
			.select('id,nom,join_code')
			.order('created_at', { ascending: true });
		if (error) err = error.message;
		else classes = (data ?? []) as Classe[];
		loading = false;
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!nom.trim()) return;
		creating = true;
		err = '';
		const { error } = await getSupabase()
			.from('classes')
			.insert({ nom: nom.trim(), etablissement_id: session.tenantId, join_code: genCode() });
		if (error) err = error.message;
		else {
			nom = '';
			await load();
		}
		creating = false;
	}

	onMount(load);
</script>

<h1>Mes classes</h1>
<p class="sub">Crée tes classes, provisionne tes élèves, lance des séances.</p>

<form class="create" onsubmit={create}>
	<input bind:value={nom} placeholder="Nom de la classe (ex. 6e B)" aria-label="Nom de la classe" />
	<Button type="submit">{creating ? 'Création…' : 'Créer la classe'}</Button>
</form>

{#if err}<p class="err">{err}</p>{/if}

{#if loading}
	<p class="muted">Chargement…</p>
{:else if classes.length === 0}
	<EmptyState icon="🏫" title="Aucune classe" description="Crée ta première classe ci-dessus." />
{:else}
	<ul class="grid">
		{#each classes as c (c.id)}
			<li>
				<a class="classe" href={`${base}/prof/classe/${c.id}`}>
					<span class="nom">{c.nom}</span>
					{#if c.join_code}<span class="code">code : {c.join_code}</span>{/if}
				</a>
				<a class="prog" href={`${base}/prof/annee?class=${c.id}`} title="Progression de la classe">📅 Progression</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.sub {
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-4);
	}
	.create {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		flex-wrap: wrap;
	}
	.create input {
		flex: 1 1 18rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.grid {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-3);
	}
	.classe {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px solid var(--role-accent);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: var(--text);
	}
	.nom {
		font-weight: 700;
		font-size: 1.05rem;
	}
	.code {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.grid li {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.prog {
		align-self: start;
		text-decoration: none;
		color: var(--role-accent);
		font-weight: 600;
		font-size: 0.85rem;
	}
	.prog:hover {
		text-decoration: underline;
	}
	.err {
		color: var(--danger);
	}
	.muted {
		color: var(--text-muted);
	}
</style>
