// Moteur de la bibliothèque : facettes (filtre), recherche, compteurs.
// ET entre facettes, OU à l'intérieur d'une facette. Une facette inactive ne filtre pas.
import type { ActivityMeta, Comp, Niveau, Support, ActivitySource } from './types';
import type { RituelType } from './rituels';

const norm = (s: string) =>
	s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface FacetState {
	q?: string;
	domaines?: Set<string>;
	comps?: Set<Comp>;
	supports?: Set<Support>;
	sources?: Set<ActivitySource>;
	niveaux?: Set<Niveau>;
	rituels?: Set<RituelType>;
	kind?: 'graded' | 'consult';
}

function searchText(a: ActivityMeta): string {
	return norm(
		[
			a.label,
			a.description ?? '',
			(a.keywords ?? []).join(' '),
			(a.taxo.gs ?? []).join(' '),
			(a.taxo.gsBonus ?? []).join(' '),
			a.taxo.sousTheme ?? '',
			a.taxo.domaineLabel ?? ''
		].join(' ')
	);
}

export function matchesSearch(a: ActivityMeta, q: string): boolean {
	const tokens = norm(q).split(/\s+/).filter(Boolean);
	if (!tokens.length) return true;
	const text = searchText(a);
	return tokens.every((t) => text.includes(t)); // reconnaît aussi « 24.4 » (présent dans le code GS)
}

// Facette inactive (set vide/absent) → ne filtre pas. Active mais item sans valeur → exclu.
function hasAny<T>(set: Set<T> | undefined, vals: T[] | undefined): boolean {
	if (!set || set.size === 0) return true;
	if (!vals || vals.length === 0) return false;
	return vals.some((v) => set.has(v));
}

export function matches(a: ActivityMeta, s: FacetState): boolean {
	if (s.q && !matchesSearch(a, s.q)) return false;
	if (s.domaines && s.domaines.size && !s.domaines.has(a.taxo.domaineKey)) return false;
	if (s.kind && a.kind !== s.kind) return false;
	if (!hasAny(s.comps, a.competences)) return false;
	if (!hasAny(s.supports, [a.support])) return false;
	if (!hasAny(s.sources, [a.source])) return false;
	if (!hasAny(s.niveaux, a.niveaux)) return false;
	if (!hasAny(s.rituels, a.rituels)) return false;
	return true;
}

export function filter(acts: ActivityMeta[], s: FacetState): ActivityMeta[] {
	return acts.filter((a) => matches(a, s));
}

// Compteur DISJONCTIF pour une facette : nombre d'items qui passeraient TOUTES les autres facettes,
// par valeur de CETTE facette (→ ne grise jamais à 0 ce qui reste élargissable).
export function countBy<T>(
	acts: ActivityMeta[],
	s: FacetState,
	facet: keyof FacetState,
	valuesOf: (a: ActivityMeta) => T[]
): Map<T, number> {
	const other = { ...s, [facet]: undefined } as FacetState;
	const pool = acts.filter((a) => matches(a, other));
	const counts = new Map<T, number>();
	for (const a of pool) for (const v of valuesOf(a)) counts.set(v, (counts.get(v) ?? 0) + 1);
	return counts;
}
