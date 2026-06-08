<script lang="ts">
	// Calculatrice 4 opérations, machine à états (PAS d'eval → compatible CSP stricte).
	let display = $state('0');
	let acc = $state<number | null>(null);
	let op = $state<string | null>(null);
	let fresh = $state(true); // le prochain chiffre commence un nouveau nombre

	function digit(d: string) {
		if (fresh) {
			display = d === '.' ? '0.' : d;
			fresh = false;
		} else {
			if (d === '.' && display.includes('.')) return;
			display = display === '0' && d !== '.' ? d : display + d;
		}
	}
	function apply(a: number, b: number, o: string): number {
		if (o === '+') return a + b;
		if (o === '−') return a - b;
		if (o === '×') return a * b;
		if (o === '÷') return b === 0 ? NaN : a / b;
		return b;
	}
	function setOp(o: string) {
		const cur = parseFloat(display);
		if (acc !== null && op && !fresh) acc = apply(acc, cur, op);
		else acc = cur;
		display = format(acc);
		op = o;
		fresh = true;
	}
	function equals() {
		if (acc === null || op === null) return;
		const cur = parseFloat(display);
		const r = apply(acc, cur, op);
		display = format(r);
		acc = null;
		op = null;
		fresh = true;
	}
	function clearAll() {
		display = '0';
		acc = null;
		op = null;
		fresh = true;
	}
	function negate() {
		display = format(-parseFloat(display));
	}
	function percent() {
		display = format(parseFloat(display) / 100);
	}
	function format(n: number): string {
		if (!isFinite(n)) return 'Erreur';
		return String(Math.round(n * 1e10) / 1e10);
	}

	const KEYS = [
		['C', '±', '%', '÷'],
		['7', '8', '9', '×'],
		['4', '5', '6', '−'],
		['1', '2', '3', '+'],
		['0', '.', '=']
	];
	function press(k: string) {
		if (k === 'C') clearAll();
		else if (k === '±') negate();
		else if (k === '%') percent();
		else if (k === '=') equals();
		else if ('+−×÷'.includes(k)) setOp(k);
		else digit(k);
	}
</script>

<div class="calc">
	<div class="screen">{display}</div>
	<div class="pad">
		{#each KEYS as row, r (r)}
			{#each row as k (k)}
				<button
					class:op={'+−×÷'.includes(k)}
					class:eq={k === '='}
					class:zero={k === '0'}
					class:fn={['C', '±', '%'].includes(k)}
					onclick={() => press(k)}>{k}</button
				>
			{/each}
		{/each}
	</div>
</div>

<style>
	.calc { width: 14rem; }
	.screen { font-variant-numeric: tabular-nums; text-align: right; font-size: 1.8rem; font-weight: 700; padding: 0.4rem 0.6rem; background: var(--gray-900); color: #fff; border-radius: var(--radius); margin-bottom: var(--space-2); overflow: hidden; }
	.pad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
	.pad button { padding: 0.7rem 0; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); font-size: 1.05rem; font-weight: 600; cursor: pointer; }
	.pad button:hover { background: var(--gray-100); }
	.pad .op { background: var(--role-accent-soft); color: var(--role-accent); }
	.pad .eq { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	.pad .fn { color: var(--text-muted); }
	.pad .zero { grid-column: span 2; }
</style>
