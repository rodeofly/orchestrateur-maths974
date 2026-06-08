// Arbre dérivé de la taxonomie (Domaine → Sous-thème → Étiquette GS → activités).
// L'arbre n'est PAS une seconde liste : il est CALCULÉ depuis les champs taxo de chaque activité.
import type { ActivityMeta } from './types';
import { DOMAINES, TRANSVERSAL } from './types';

export interface GsLeaf {
	gs: string | null; // code GS, ou null = « sans étiquette »
	activities: ActivityMeta[];
}
export interface SousThemeNode {
	key: string;
	label: string;
	leaves: GsLeaf[];
	count: number;
}
export interface DomaineNode {
	key: string;
	label: string;
	sousThemes: SousThemeNode[];
	count: number;
}

const SANS_ST = '(sans sous-thème)';

export function buildTree(acts: ActivityMeta[]): DomaineNode[] {
	// domaineKey → sousThemeLabel → gsCode|'' → activities
	const byDom = new Map<string, Map<string, Map<string, ActivityMeta[]>>>();

	function place(a: ActivityMeta, gs: string | null) {
		const dk = a.taxo.domaineKey || TRANSVERSAL;
		const st = a.taxo.sousTheme || SANS_ST;
		const leaf = gs ?? '';
		const dom = byDom.get(dk) ?? new Map();
		byDom.set(dk, dom);
		const sub = dom.get(st) ?? new Map();
		dom.set(st, sub);
		const arr = sub.get(leaf) ?? [];
		sub.set(leaf, arr);
		arr.push(a);
	}

	for (const a of acts) {
		const codes = a.taxo.gs && a.taxo.gs.length ? a.taxo.gs : [null];
		for (const gs of codes) place(a, gs); // multi-GS → indexé N fois (même objet)
	}

	const order = new Map(DOMAINES.map((d, i) => [d.key, i]));
	const label = new Map(DOMAINES.map((d) => [d.key, d.label]));

	const domaines: DomaineNode[] = [];
	for (const [dk, subs] of byDom) {
		const sousThemes: SousThemeNode[] = [];
		for (const [st, leavesMap] of subs) {
			const leaves: GsLeaf[] = [...leavesMap.entries()].map(([gs, activities]) => ({
				gs: gs || null,
				activities
			}));
			leaves.sort((a, b) => (a.gs ?? '~').localeCompare(b.gs ?? '~', 'fr', { numeric: true }));
			const count = leaves.reduce((n, l) => n + l.activities.length, 0);
			sousThemes.push({ key: st, label: st, leaves, count });
		}
		sousThemes.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
		const count = sousThemes.reduce((n, s) => n + s.count, 0);
		domaines.push({ key: dk, label: label.get(dk) ?? dk, sousThemes, count });
	}
	domaines.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
	return domaines;
}
