// Action Svelte : rend un élément déplaçable au pointeur (translate via transform).
// Optionnel : `handle` (sélecteur du « mors » de prise). Position persistée sur le node.
export function draggable(node: HTMLElement, opts: { handle?: string } = {}) {
	let x = 0;
	let y = 0;
	let startX = 0;
	let startY = 0;
	let dragging = false;

	const handle = opts.handle ? (node.querySelector(opts.handle) as HTMLElement) : node;
	if (!handle) return {};

	function apply() {
		node.style.transform = `translate(${x}px, ${y}px)`;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		startX = e.clientX - x;
		startY = e.clientY - y;
		handle.setPointerCapture(e.pointerId);
		handle.style.cursor = 'grabbing';
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		x = e.clientX - startX;
		y = e.clientY - startY;
		apply();
	}
	function up(e: PointerEvent) {
		dragging = false;
		try {
			handle.releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		handle.style.cursor = '';
	}

	handle.style.touchAction = 'none';
	handle.style.cursor = 'grab';
	handle.addEventListener('pointerdown', down);
	handle.addEventListener('pointermove', move);
	handle.addEventListener('pointerup', up);

	return {
		destroy() {
			handle.removeEventListener('pointerdown', down);
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
		}
	};
}
