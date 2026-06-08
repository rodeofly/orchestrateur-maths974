<script lang="ts">
	import { onDestroy } from 'svelte';

	let mode = $state<'minuteur' | 'chrono'>('minuteur');
	let running = $state(false);
	let elapsed = $state(0); // chronomètre (ms écoulés)
	let remaining = $state(300000); // minuteur (ms restants)
	let setMin = $state(5);
	let setSec = $state(0);

	let timer: ReturnType<typeof setInterval> | null = null;
	let last = 0;

	function tick() {
		const now = Date.now();
		const dt = now - last;
		last = now;
		if (mode === 'chrono') elapsed += dt;
		else {
			remaining = Math.max(0, remaining - dt);
			if (remaining === 0) pause();
		}
	}
	function start() {
		if (running) return;
		if (mode === 'minuteur' && remaining === 0) reset();
		running = true;
		last = Date.now();
		timer = setInterval(tick, 100);
	}
	function pause() {
		running = false;
		if (timer) clearInterval(timer);
		timer = null;
	}
	function reset() {
		pause();
		if (mode === 'chrono') elapsed = 0;
		else remaining = (setMin * 60 + setSec) * 1000;
	}
	function setMode(m: 'minuteur' | 'chrono') {
		mode = m;
		reset();
	}
	// Recalcule le minuteur quand on change la consigne (à l'arrêt).
	$effect(() => {
		const ms = (setMin * 60 + setSec) * 1000;
		if (mode === 'minuteur' && !running) remaining = ms;
	});
	onDestroy(pause);

	const fmt = (ms: number) => {
		const t = Math.ceil(ms / 1000);
		const m = Math.floor(t / 60);
		const s = t % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	};
	const display = $derived(mode === 'chrono' ? fmt(elapsed) : fmt(remaining));
	const danger = $derived(mode === 'minuteur' && remaining <= 10000 && remaining > 0);
	const done = $derived(mode === 'minuteur' && remaining === 0);
</script>

<div class="chrono">
	<div class="modes">
		<button class:active={mode === 'minuteur'} onclick={() => setMode('minuteur')}>⏳ Minuteur</button>
		<button class:active={mode === 'chrono'} onclick={() => setMode('chrono')}>⏱ Chrono</button>
	</div>

	<div class="display" class:danger class:done class:run={running}>{display}</div>

	{#if mode === 'minuteur'}
		<div class="set">
			<label>min <input type="number" min="0" max="99" bind:value={setMin} disabled={running} /></label>
			<label>sec <input type="number" min="0" max="59" bind:value={setSec} disabled={running} /></label>
			<div class="presets">
				{#each [1, 2, 5, 10] as m (m)}
					<button onclick={() => { setMin = m; setSec = 0; }} disabled={running}>{m}′</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="ctrl">
		{#if !running}
			<button class="go" onclick={start}>▶</button>
		{:else}
			<button class="go" onclick={pause}>⏸</button>
		{/if}
		<button onclick={reset}>↺</button>
	</div>
</div>

<style>
	.chrono { display: grid; gap: var(--space-2); min-width: 12rem; }
	.modes { display: flex; gap: 0.25rem; }
	.modes button { flex: 1; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 0.3rem; font-size: 0.78rem; cursor: pointer; }
	.modes button.active { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	.display { font-variant-numeric: tabular-nums; font-size: 2.8rem; font-weight: 800; text-align: center; line-height: 1; padding: 0.3rem 0; }
	.display.run { color: var(--brand); }
	.display.danger { color: var(--warning); animation: pulse 1s infinite; }
	.display.done { color: var(--danger); }
	@keyframes pulse { 50% { opacity: 0.45; } }
	.set { display: grid; gap: var(--space-2); }
	.set label { font-size: 0.78rem; color: var(--text-muted); display: inline-flex; gap: 0.3rem; align-items: center; }
	.set input { width: 3.2rem; padding: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
	.presets { display: flex; gap: 0.25rem; }
	.presets button { flex: 1; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 0.25rem; cursor: pointer; font-size: 0.8rem; }
	.ctrl { display: flex; gap: var(--space-2); }
	.ctrl button { flex: 1; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); padding: 0.4rem; font-size: 1.1rem; cursor: pointer; }
	.ctrl .go { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
</style>
