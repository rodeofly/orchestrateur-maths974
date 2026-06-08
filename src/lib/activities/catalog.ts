// Catalogue d'activités — AGRÉGATEUR. Les activités GS viennent du manifeste auto-généré
// (npm run sync:catalog) ; les apps non-GS sont déclarées à la main (≈1 entrée/app).
// Cf. docs/BIBLIOTHEQUE.md.
import type { ActivityMeta } from './types';
import gsManifest from './manifests/gs.json';
import { APP_ACTIVITIES } from './sources/apps';
import { detectActivity, isExternalLinkId } from './detect';

export type Activity = ActivityMeta; // alias rétro-compat (les écrans importent `type Activity`)

// ── Sources non-GS (déclaratif, ~1 entrée par app) ──
const LAMBDAZEF = { originDev: 'http://localhost:5173', originProd: 'https://rodeofly.github.io/VicBret974' };

const HAND: ActivityMeta[] = [
	{
		id: 'lambdazef',
		source: 'lambdazef',
		label: 'λ-Zèf — les œufs alligator',
		emoji: '🐊',
		description: 'Calcul fonctionnel (λ-calcul) en nourrissant les alligators.',
		kind: 'graded',
		support: 'jeu',
		canonical: true,
		embed: { ...LAMBDAZEF, path: '/', connector: 'm974' },
		taxo: { domaineKey: '06-pensee-informatique', domaineLabel: 'Pensée informatique' },
		competences: ['ra'],
		rituels: ['zefor', 'divertissement'],
		keywords: ['lambda', 'calcul', 'fonction', 'alligator', 'logique']
	}
];

// ── Activités GS (manifeste vendoré) : on injecte l'origine déclarée par le manifeste ──
const gsOrigin = (gsManifest as { origin: { dev: string; prod: string } }).origin;
const gsActs: ActivityMeta[] = (gsManifest as { activities: ActivityMeta[] }).activities.map((a) => ({
	...a,
	embed: { ...a.embed, originDev: gsOrigin.dev, originProd: gsOrigin.prod }
}));

export const ACTIVITIES: ActivityMeta[] = [...HAND, ...APP_ACTIVITIES, ...gsActs];

export function activityUrl(a: ActivityMeta): string {
	// Repli sur l'origine prod si pas de serveur de dev déclaré (apps déjà déployées).
	const origin =
		(import.meta.env.DEV ? a.embed.originDev : a.embed.originProd) ?? a.embed.originProd ?? '';
	return origin + a.embed.path;
}

export function getActivity(id: string): ActivityMeta | undefined {
	// Lien externe collé par le prof (l'URL est l'id) → on synthétise la meta à la volée.
	if (isExternalLinkId(id)) return detectActivity(id) ?? undefined;
	return ACTIVITIES.find((a) => a.id === id);
}
