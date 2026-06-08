<script lang="ts">
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase/client';

	let classes = $state<{ id: string; nom: string }[]>([]);
	let classId = $state('');
	let roster = $state<string[]>([]);
	let mode = $state<'de' | 'eleve' | 'groupes'>('de');

	let faces = $state(6);
	let dieResult = $state<number | null>(null);

	let pickedStudent = $state('');
	let groupSize = $state(3);
	let groups = $state<string[][]>([]);

	async function loadClasses() {
		const { data } = await getSupabase().from('classes').select('id,nom').order('created_at');
		classes = data ?? [];
	}
	async function loadRoster() {
		if (!classId) {
			roster = [];
			return;
		}
		const { data } = await getSupabase()
			.from('class_students')
			.select('student_alias')
			.eq('class_id', classId);
		roster = (data ?? []).map((r: { student_alias: string | null }) => r.student_alias ?? '').filter(Boolean);
	}
	$effect(() => {
		void classId;
		loadRoster();
	});

	const rand = (n: number) => Math.floor(Math.random() * n);
	const rollDie = () => (dieResult = 1 + rand(Math.max(2, faces)));
	const pickStudent = () => (pickedStudent = roster.length ? roster[rand(roster.length)] : '(classe vide)');
	function makeGroups() {
		const sh = [...roster].sort(() => Math.random() - 0.5);
		const g: string[][] = [];
		for (let i = 0; i < sh.length; i += Math.max(2, groupSize)) g.push(sh.slice(i, i + Math.max(2, groupSize)));
		groups = g;
	}
	onMount(loadClasses);
</script>

<div class="tirage">
	<div class="modes">
		<button class:active={mode === 'de'} onclick={() => (mode = 'de')}>🎲 Dé</button>
		<button class:active={mode === 'eleve'} onclick={() => (mode = 'eleve')}>🙋 Élève</button>
		<button class:active={mode === 'groupes'} onclick={() => (mode = 'groupes')}>👥 Groupes</button>
	</div>

	{#if mode !== 'de'}
		<select bind:value={classId} aria-label="Classe">
			<option value="">— choisir une classe —</option>
			{#each classes as c (c.id)}<option value={c.id}>{c.nom} ({roster.length && classId === c.id ? roster.length : '?'})</option>{/each}
		</select>
	{/if}

	{#if mode === 'de'}
		<label class="faces">faces <input type="number" min="2" max="100" bind:value={faces} /></label>
		<div class="big">{dieResult ?? '🎲'}</div>
		<button class="go" onclick={rollDie}>Lancer le dé</button>
	{:else if mode === 'eleve'}
		<div class="big name">{pickedStudent || '🙋'}</div>
		<button class="go" onclick={pickStudent} disabled={!roster.length}>Tirer un élève</button>
	{:else}
		<label class="faces">par groupe de <input type="number" min="2" max="10" bind:value={groupSize} /></label>
		<button class="go" onclick={makeGroups} disabled={!roster.length}>Former les groupes</button>
		{#if groups.length}
			<div class="groups">
				{#each groups as g, i (i)}
					<div class="grp"><span class="g-n">G{i + 1}</span> {g.join(', ')}</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.tirage { display: grid; gap: var(--space-2); min-width: 13rem; }
	.modes { display: flex; gap: 0.25rem; }
	.modes button { flex: 1; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 0.3rem; font-size: 0.75rem; cursor: pointer; }
	.modes button.active { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	select, .faces input { padding: 0.3rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
	.faces { font-size: 0.78rem; color: var(--text-muted); display: inline-flex; gap: 0.3rem; align-items: center; }
	.faces input { width: 4rem; }
	.big { text-align: center; font-size: 3rem; font-weight: 800; line-height: 1.1; min-height: 3.2rem; }
	.big.name { font-size: 2rem; color: var(--role-accent); }
	.go { background: var(--role-accent); color: #fff; border: none; border-radius: var(--radius); padding: 0.5rem; font-weight: 700; cursor: pointer; }
	.go:disabled { opacity: 0.5; cursor: default; }
	.groups { display: grid; gap: 0.3rem; max-height: 12rem; overflow: auto; }
	.grp { font-size: 0.88rem; padding: 0.3rem 0.5rem; background: var(--gray-50); border: 1px solid var(--border); border-radius: var(--radius-sm); }
	.g-n { font-weight: 700; color: var(--role-accent); }
</style>
