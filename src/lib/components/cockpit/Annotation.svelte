<script lang="ts">
	import { onMount } from 'svelte';

	// Overlay de dessin transparent AU-DESSUS du contenu (on ne peut pas dessiner DANS
	// une iframe cross-origin → on superpose un canvas). Désactivé = transparent aux clics.
	let { active = false }: { active?: boolean } = $props();

	let wrap = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let ctx: CanvasRenderingContext2D | null = null;

	let color = $state('#111827');
	let width = $state(4);
	let eraser = $state(false);
	let drawing = false;

	// Instruments géométriques (guides semi-transparents, déplaçables + pivotables).
	let rapr = $state({ on: false, x: 80, y: 120, a: 0 });
	let equ = $state({ on: false, x: 360, y: 140, a: 0 });

	const PALETTE = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#f59e0b'];
	// Graduations du rapporteur (tous les 10°), demi-cercle rayon R.
	const R = 130;
	const ticks = Array.from({ length: 19 }, (_, i) => i * 10);
	const pt = (deg: number, rad: number) => {
		const t = (deg * Math.PI) / 180;
		return { x: R + rad * Math.cos(t), y: R - rad * Math.sin(t) };
	};

	function setup() {
		if (!canvas || !wrap) return;
		const r = wrap.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, r.width * dpr);
		canvas.height = Math.max(1, r.height * dpr);
		canvas.style.width = `${r.width}px`;
		canvas.style.height = `${r.height}px`;
		ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.scale(dpr, dpr);
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
		}
	}
	const pos = (e: PointerEvent) => {
		const r = canvas!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};
	function strokeTo(p: { x: number; y: number }) {
		if (!ctx) return;
		ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
		ctx.strokeStyle = color;
		ctx.lineWidth = eraser ? width * 5 : width;
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
	}
	function down(e: PointerEvent) {
		if (!ctx) return;
		drawing = true;
		canvas!.setPointerCapture(e.pointerId);
		const p = pos(e);
		ctx.beginPath();
		ctx.moveTo(p.x, p.y);
		strokeTo({ x: p.x + 0.01, y: p.y + 0.01 }); // point
	}
	function move(e: PointerEvent) {
		if (drawing) strokeTo(pos(e));
	}
	const up = () => (drawing = false);
	function clearAll() {
		if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
	}

	// Déplacer / pivoter un instrument.
	function startMove(e: PointerEvent, o: { x: number; y: number }) {
		e.stopPropagation();
		const sx = e.clientX - o.x;
		const sy = e.clientY - o.y;
		const mv = (ev: PointerEvent) => {
			o.x = ev.clientX - sx;
			o.y = ev.clientY - sy;
		};
		const end = () => {
			window.removeEventListener('pointermove', mv);
			window.removeEventListener('pointerup', end);
		};
		window.addEventListener('pointermove', mv);
		window.addEventListener('pointerup', end);
	}
	function startRotate(e: PointerEvent, o: { a: number }) {
		e.stopPropagation();
		const el = (e.currentTarget as HTMLElement).closest('.instr') as HTMLElement;
		const r = el.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const cy = r.top + r.height / 2;
		const a0 = o.a;
		const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
		const mv = (ev: PointerEvent) => {
			const ang = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
			o.a = a0 + (ang - start);
		};
		const end = () => {
			window.removeEventListener('pointermove', mv);
			window.removeEventListener('pointerup', end);
		};
		window.addEventListener('pointermove', mv);
		window.addEventListener('pointerup', end);
	}

	onMount(() => {
		setup();
		const ro = new ResizeObserver(setup);
		if (wrap) ro.observe(wrap);
		return () => ro.disconnect();
	});
</script>

<div class="overlay" class:active bind:this={wrap}>
	<canvas
		bind:this={canvas}
		class="canvas"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
	></canvas>

	{#if rapr.on}
		<div class="instr" style="transform: translate({rapr.x}px,{rapr.y}px) rotate({rapr.a}deg)">
			<svg class="body" width={2 * R} height={R + 20} viewBox={`0 0 ${2 * R} ${R + 20}`} onpointerdown={(e) => startMove(e, rapr)} role="presentation">
				<path d={`M0,${R} A${R},${R} 0 0 1 ${2 * R},${R} Z`} fill="rgba(37,99,235,0.12)" stroke="#2563eb" />
				{#each ticks as d (d)}
					{@const o = pt(d, R)}
					{@const i = pt(d, d % 30 === 0 ? R - 18 : R - 9)}
					<line x1={o.x} y1={o.y} x2={i.x} y2={i.y} stroke="#2563eb" stroke-width={d % 90 === 0 ? 1.6 : 0.8} />
					{#if d % 30 === 0}{@const l = pt(d, R - 30)}<text x={l.x} y={l.y} font-size="11" fill="#1e40af" text-anchor="middle" dominant-baseline="middle">{d}</text>{/if}
				{/each}
				<circle cx={R} cy={R} r="3" fill="#2563eb" />
			</svg>
			<button class="rot" onpointerdown={(e) => startRotate(e, rapr)} title="Pivoter">⟳</button>
		</div>
	{/if}

	{#if equ.on}
		<div class="instr" style="transform: translate({equ.x}px,{equ.y}px) rotate({equ.a}deg)">
			<svg class="body" width="240" height="160" viewBox="0 0 240 160" onpointerdown={(e) => startMove(e, equ)} role="presentation">
				<polygon points="10,150 230,150 10,20" fill="rgba(22,163,74,0.12)" stroke="#16a34a" stroke-width="1.5" />
				<rect x="10" y="135" width="15" height="15" fill="none" stroke="#16a34a" stroke-width="1" />
				{#each Array.from({ length: 22 }, (_, i) => i) as i (i)}
					<line x1={10 + i * 10} y1="150" x2={10 + i * 10} y2={i % 5 === 0 ? 140 : 145} stroke="#16a34a" stroke-width="0.8" />
				{/each}
			</svg>
			<button class="rot" onpointerdown={(e) => startRotate(e, equ)} title="Pivoter">⟳</button>
		</div>
	{/if}

	{#if active}
		<div class="bar">
			{#each PALETTE as c (c)}
				<button class="sw" class:on={color === c && !eraser} style="background:{c}" onclick={() => { color = c; eraser = false; }} aria-label="couleur"></button>
			{/each}
			<input class="w" type="range" min="2" max="20" bind:value={width} title="épaisseur" />
			<button class:on={eraser} onclick={() => (eraser = !eraser)}>🧽 Gomme</button>
			<button onclick={clearAll}>🗑 Effacer</button>
			<span class="sep"></span>
			<button class:on={rapr.on} onclick={() => (rapr.on = !rapr.on)}>📐 Rapporteur</button>
			<button class:on={equ.on} onclick={() => (equ.on = !equ.on)}>📐 Équerre</button>
		</div>
	{/if}
</div>

<style>
	.overlay { position: absolute; inset: 0; pointer-events: none; z-index: 20; }
	.overlay.active { pointer-events: auto; }
	.canvas { position: absolute; inset: 0; touch-action: none; cursor: crosshair; }
	.overlay:not(.active) .canvas { cursor: default; }
	.instr { position: absolute; top: 0; left: 0; pointer-events: auto; }
	.instr .body { cursor: grab; }
	.instr .rot { position: absolute; top: -10px; right: -10px; width: 1.8rem; height: 1.8rem; min-height: 0; border-radius: 50%; border: 1px solid var(--border); background: #fff; cursor: grab; box-shadow: var(--shadow-sm); }
	.bar { position: absolute; bottom: var(--space-3); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-2); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 0.4rem 0.8rem; box-shadow: var(--shadow); pointer-events: auto; flex-wrap: wrap; }
	.bar button { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.82rem; min-height: 0; }
	.bar button.on { background: var(--role-accent); color: #fff; border-color: var(--role-accent); }
	.sw { width: 1.5rem; height: 1.5rem; border-radius: 50% !important; padding: 0 !important; }
	.sw.on { outline: 2px solid var(--gray-900); outline-offset: 1px; }
	.w { width: 5rem; }
	.sep { width: 1px; align-self: stretch; background: var(--border); }
</style>
