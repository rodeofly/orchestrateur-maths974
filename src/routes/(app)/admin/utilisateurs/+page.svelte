<script lang="ts">
	// Gestion des comptes ADULTES de l'établissement (prof/parent/admin) : rôle + invitation.
	// Les élèves (mineurs) ne sont PAS listés ici (gérés via les classes / provisionnement).
	// Aucune PII inutile (pas d'e-mail). Les écritures passent par des Edge Functions privilégiées.
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase/client';
	import { session } from '$auth/session.svelte';
	import { ROLE_LABELS } from '$auth/roles';
	import Card from '$components/ui/Card.svelte';
	import EmptyState from '$components/ui/EmptyState.svelte';

	type User = { id: string; display_name: string | null; role: string };
	const ADULT_ROLES = ['prof', 'parent', 'admin'] as const;

	let users = $state<User[]>([]);
	let loading = $state(true);
	let err = $state('');
	let msg = $state('');
	let busy = $state('');

	// Invitation
	let email = $state('');
	let inviteRole = $state<'prof' | 'parent'>('prof');
	let inviting = $state(false);

	async function load() {
		loading = true;
		err = '';
		const { data, error } = await getSupabase()
			.from('profiles')
			.select('id, display_name, role')
			.eq('etablissement_id', session.tenantId)
			.eq('is_minor', false)
			.order('role');
		if (error) err = error.message;
		else users = (data ?? []) as User[];
		loading = false;
	}

	async function changeRole(u: User, role: string) {
		if (role === u.role) return;
		busy = u.id;
		msg = '';
		const { error } = await getSupabase().functions.invoke('set-user-role', {
			body: { userId: u.id, role }
		});
		busy = '';
		if (error) {
			msg = '⚠ Changement refusé (droits, dernier admin, ou compte élève).';
			await load(); // resynchronise l'affichage
		} else {
			msg = '✅ Rôle mis à jour.';
			await load();
		}
	}

	async function invite(e: SubmitEvent) {
		e.preventDefault();
		if (!email.trim()) return;
		inviting = true;
		msg = '';
		const { error } = await getSupabase().functions.invoke('invite-user', {
			body: { email: email.trim(), role: inviteRole }
		});
		inviting = false;
		msg = error
			? '⚠ Invitation indisponible (fonction déployée ? SMTP configuré ?).'
			: 'Si l’adresse est éligible, une invitation a été envoyée. 📧';
		email = '';
	}

	onMount(load);
</script>

<h1>Utilisateurs</h1>
<p class="sub">Gère les adultes de ton établissement (enseignants, parents, administrateurs).</p>

<Card>
	<h2>Inviter un adulte</h2>
	<form onsubmit={invite}>
		<input type="email" bind:value={email} placeholder="adresse e-mail" aria-label="E-mail" required />
		<select bind:value={inviteRole} aria-label="Rôle">
			<option value="prof">Enseignant</option>
			<option value="parent">Parent</option>
		</select>
		<button type="submit" disabled={inviting}>{inviting ? 'Envoi…' : 'Inviter'}</button>
	</form>
	<p class="hint">Les élèves (mineurs) ne s’invitent pas par e-mail : ils sont provisionnés depuis une classe (code + PIN).</p>
</Card>

{#if msg}<p class="msg">{msg}</p>{/if}

<h2 class="mt">Comptes ({users.length})</h2>
{#if loading}
	<p class="muted">Chargement…</p>
{:else if err}
	<p class="err">{err}</p>
{:else if users.length === 0}
	<EmptyState icon="👥" title="Aucun adulte" description="Invite des enseignants ou parents ci-dessus." />
{:else}
	<ul class="list">
		{#each users as u (u.id)}
			<li>
				<span class="name">{u.display_name ?? '—'}{#if u.id === session.userId}<em> (toi)</em>{/if}</span>
				{#if u.id === session.userId}
					<span class="role-self">{ROLE_LABELS[u.role as 'admin']}</span>
				{:else}
					<select
						value={u.role}
						disabled={busy === u.id}
						onchange={(e) => changeRole(u, (e.currentTarget as HTMLSelectElement).value)}
						aria-label="Rôle de {u.display_name ?? u.id}"
					>
						{#each ADULT_ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
					</select>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.sub { color: var(--text-muted); margin: var(--space-2) 0 var(--space-4); }
	.mt { margin-top: var(--space-5); }
	h2 { font-size: 1.1rem; margin-bottom: var(--space-3); }
	form { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	form input { flex: 1 1 16rem; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	form select, form button { padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); }
	form button { background: var(--role-accent); color: #fff; border-color: var(--role-accent); font-weight: 600; cursor: pointer; }
	.hint { font-size: 0.82rem; color: var(--text-muted); margin-top: var(--space-2); }
	.list { list-style: none; padding: 0; display: grid; gap: var(--space-2); }
	.list li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 0.6rem 0.9rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
	.name { font-weight: 600; }
	.name em { color: var(--text-muted); font-weight: 400; }
	.role-self { color: var(--text-muted); font-size: 0.85rem; }
	.list select { padding: 0.35rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
	.msg { font-weight: 600; margin: var(--space-3) 0; }
	.muted { color: var(--text-muted); }
	.err { color: var(--danger); }
</style>
