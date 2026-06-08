<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/supabase/client';
	import { refreshSession, session } from '$auth/session.svelte';
	import { homeFor } from '$auth/roles';

	type Tab = 'adulte' | 'eleve';
	let tab = $state<Tab>('adulte');
	let busy = $state(false);
	let message = $state('');
	let error = $state('');

	// Adulte (prof / parent / admin)
	let email = $state('');
	let password = $state('');

	// Élève (sans e-mail : code classe + identifiant + code secret)
	let classCode = $state('');
	let login = $state('');
	let pin = $state('');

	function fail(e: unknown) {
		error = e instanceof Error ? e.message : String(e);
	}

	async function afterAuth() {
		await refreshSession();
		await goto(`${base}${homeFor(session.role)}`, { replaceState: true });
	}

	async function signInPassword(e: SubmitEvent) {
		e.preventDefault();
		error = message = '';
		busy = true;
		try {
			const { error: err } = await getSupabase().auth.signInWithPassword({ email, password });
			if (err) throw err;
			await afterAuth();
		} catch (e2) {
			fail(e2);
		} finally {
			busy = false;
		}
	}

	async function sendMagicLink() {
		error = message = '';
		if (!email) {
			error = 'Renseigne ton adresse e-mail.';
			return;
		}
		busy = true;
		try {
			const { error: err } = await getSupabase().auth.signInWithOtp({
				email,
				options: { emailRedirectTo: `${location.origin}${base}/auth/callback` }
			});
			if (err) throw err;
			message = 'Lien de connexion envoyé. Vérifie ta boîte mail.';
		} catch (e2) {
			fail(e2);
		} finally {
			busy = false;
		}
	}

	async function signInStudent(e: SubmitEvent) {
		e.preventDefault();
		error = message = '';
		busy = true;
		try {
			const sb = getSupabase();
			// L'Edge Function vérifie {classCode, login, pin} et renvoie un token de session.
			const { data, error: err } = await sb.functions.invoke('student-signin', {
				body: { classCode, login, pin }
			});
			if (err) throw err;
			const tokenHash = (data as { token_hash?: string } | null)?.token_hash;
			if (!tokenHash) throw new Error('réponse invalide');
			// On confirme le token → la session est posée.
			const { error: vErr } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
			if (vErr) throw vErr;
			await afterAuth();
		} catch {
			error = 'Connexion élève impossible (identifiants ou fonction non déployée). Voir supabase/SETUP.md.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="page">
	<div class="card">
		<h1>Connexion</h1>

		<div class="tabs" role="tablist">
			<button role="tab" aria-selected={tab === 'adulte'} class:active={tab === 'adulte'} onclick={() => (tab = 'adulte')}>
				Enseignant · Parent · Admin
			</button>
			<button role="tab" aria-selected={tab === 'eleve'} class:active={tab === 'eleve'} onclick={() => (tab = 'eleve')}>
				Élève
			</button>
		</div>

		{#if tab === 'adulte'}
			<form onsubmit={signInPassword}>
				<label>E-mail<input type="email" bind:value={email} autocomplete="email" required /></label>
				<label>Mot de passe<input type="password" bind:value={password} autocomplete="current-password" /></label>
				<button class="primary" type="submit" disabled={busy}>Se connecter</button>
				<button class="link" type="button" onclick={sendMagicLink} disabled={busy}>
					Recevoir un lien de connexion par e-mail
				</button>
			</form>
		{:else}
			<form onsubmit={signInStudent}>
				<label>Code de la classe<input bind:value={classCode} autocomplete="off" required /></label>
				<label>Identifiant<input bind:value={login} autocomplete="off" required /></label>
				<label>Code secret<input type="password" bind:value={pin} autocomplete="off" required /></label>
				<button class="primary" type="submit" disabled={busy}>Entrer</button>
				<p class="hint">Pas d’e-mail : ton professeur t’a donné un code de classe, un identifiant et un code secret.</p>
			</form>
		{/if}

		{#if message}<p class="ok">{message}</p>{/if}
		{#if error}<p class="err">{error}</p>{/if}
	</div>
	<p class="back"><a href={`${base}/`}>← Retour à l'accueil</a></p>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		gap: var(--space-3);
		padding: var(--space-4);
	}
	.card {
		width: min(26rem, 92vw);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: var(--space-6);
	}
	h1 {
		margin-bottom: var(--space-4);
	}
	.tabs {
		display: flex;
		gap: var(--space-1);
		background: var(--gray-100);
		border-radius: var(--radius);
		padding: 0.25rem;
		margin-bottom: var(--space-4);
	}
	.tabs button {
		flex: 1;
		border: none;
		background: transparent;
		padding: 0.55rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--text-muted);
	}
	.tabs button.active {
		background: var(--surface);
		color: var(--brand);
		box-shadow: var(--shadow-sm);
	}
	form {
		display: grid;
		gap: var(--space-3);
	}
	label {
		display: grid;
		gap: var(--space-1);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	input {
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.primary {
		background: var(--brand);
		color: #fff;
		border: none;
		padding: 0.7rem;
		border-radius: var(--radius);
		font-weight: 700;
		cursor: pointer;
	}
	.link {
		background: none;
		border: none;
		color: var(--brand);
		cursor: pointer;
		font-size: 0.85rem;
		text-decoration: underline;
	}
	.hint {
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.ok {
		color: var(--success);
		font-size: 0.9rem;
	}
	.err {
		color: var(--danger);
		font-size: 0.9rem;
	}
	.back {
		text-align: center;
	}
</style>
