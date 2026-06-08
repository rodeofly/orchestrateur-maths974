// Compatibilité rituel → activités : pré-filtre la bibliothèque par INTENTION.
// Le prof ne browse pas à plat : il remplit un slot de rituel ; on lui montre d'abord
// ce qui colle (affinité rituel OU compétences socle du rituel), repli progressif.
import { ACTIVITIES } from './catalog';
import { getRituel, type RituelType } from './rituels';
import type { ActivityMeta, Comp } from './types';

/** Activités recommandées pour un rituel : affinité déclarée OU compétences du rituel. */
export function candidatesFor(rituel: RituelType): ActivityMeta[] {
	const comps = new Set<string>(getRituel(rituel).competences);
	const reco = ACTIVITIES.filter(
		(a) => a.rituels?.includes(rituel) || (a.competences ?? []).some((c) => comps.has(c))
	);
	// Repli : si le rituel ne cible rien (ex. divertissement), on ouvre tout.
	return reco.length ? reco : ACTIVITIES;
}

/** Score de pertinence simple (affinité rituel = +2, compétence partagée = +1). */
export function score(a: ActivityMeta, rituel: RituelType): number {
	const comps = new Set<Comp>(getRituel(rituel).competences as Comp[]);
	let s = 0;
	if (a.rituels?.includes(rituel)) s += 2;
	s += (a.competences ?? []).filter((c) => comps.has(c)).length;
	return s;
}
