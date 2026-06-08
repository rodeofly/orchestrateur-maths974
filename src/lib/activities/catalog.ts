// Catalogue d'activités — agrégateur + helpers. Aujourd'hui 5 entrées tagguées à la main ;
// demain peuplé par les manifestes auto-générés des sources (cf. docs/BIBLIOTHEQUE.md, Étapes 4-6).
import type { ActivityMeta } from './types';

// Alias rétro-compat : les écrans importent `type Activity`.
export type Activity = ActivityMeta;

const GS = { originDev: 'http://localhost:4321', originProd: 'https://automaths.maths974.fr' };
const LAMBDAZEF = { originDev: 'http://localhost:5173', originProd: 'https://rodeofly.github.io/VicBret974' };
const gsFiche = (slug: string) => `/automaths/eleve/?ref=${slug}`;

export const ACTIVITIES: ActivityMeta[] = [
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
	},
	{
		id: 'gs:zefor974/01-retour-unite',
		source: 'gs',
		label: 'Retour à l’unité (Zefor)',
		emoji: '🍎',
		description: 'Proportionnalité — méthode du retour à l’unité (GS 24.4).',
		kind: 'graded',
		support: 'fiche',
		canonical: true,
		embed: { ...GS, path: gsFiche('zefor974/01-retour-unite'), connector: 'm974' },
		taxo: { gs: ['GS 24.4'], domaineKey: '05-proportionnalite', domaineLabel: 'Proportionnalité', sousTheme: '24. Proportionnalité' },
		competences: ['ra', 'ch'],
		niveaux: ['fragile', 'satisfaisant', 'tres-satisfaisant'],
		rituels: ['zefor', 'probleme'],
		keywords: ['proportionnalité', 'retour à l’unité', 'unité']
	},
	{
		id: 'gs:zefor974/02-glisse-nombre',
		source: 'gs',
		label: 'Glisse-nombre (Zefor)',
		emoji: '🔢',
		description: 'Multiplier / diviser par 10, 100, 1000 (GS 3.11–3.12).',
		kind: 'graded',
		support: 'manipulable',
		canonical: true,
		embed: { ...GS, path: gsFiche('zefor974/02-glisse-nombre'), connector: 'm974' },
		taxo: { gs: ['GS 3.11'], gsBonus: ['GS 3.12'], domaineKey: '01-nombres-et-calculs', domaineLabel: 'Nombres et calculs', sousTheme: '3. Nombres décimaux' },
		competences: ['ca'],
		rituels: ['rapido', 'zefor'],
		keywords: ['décimaux', 'multiplier', 'diviser', '10 100 1000', 'virgule']
	},
	{
		id: 'gs:zefor974/03-tableur',
		source: 'gs',
		label: 'Tableur (Zefor)',
		emoji: '📊',
		description: 'Vocabulaire, formules et DNB sur tableur (GS 19.3).',
		kind: 'graded',
		support: 'tableur',
		canonical: true,
		embed: { ...GS, path: gsFiche('zefor974/03-tableur'), connector: 'm974' },
		taxo: { gs: ['GS 19.3'], domaineKey: '06-pensee-informatique', domaineLabel: 'Pensée informatique', sousTheme: 'Tableur' },
		competences: ['re', 'ca'],
		rituels: ['zefor', 'probleme'],
		keywords: ['tableur', 'formule', 'cellule', 'dnb', 'somme', 'moyenne']
	},
	{
		id: 'gs:zefor974/03-volume-cubes',
		source: 'gs',
		label: 'Volume de cubes (Zefor)',
		emoji: '🧊',
		description: 'Volume du pavé droit, formule produit (GS 12.4).',
		kind: 'graded',
		support: 'manipulable',
		canonical: true,
		embed: { ...GS, path: gsFiche('zefor974/03-volume-cubes'), connector: 'm974' },
		taxo: { gs: ['GS 12.4'], domaineKey: '02-grandeurs-et-mesures', domaineLabel: 'Grandeurs et mesures', sousTheme: '12. Volumes' },
		competences: ['re', 'ca'],
		rituels: ['zefor', 'probleme'],
		keywords: ['volume', 'pavé', 'cube', 'produit', 'cm³']
	}
];

export function activityUrl(a: ActivityMeta): string {
	const origin = (import.meta.env.DEV ? a.embed.originDev : a.embed.originProd) ?? '';
	return origin + a.embed.path;
}

export function getActivity(id: string): ActivityMeta | undefined {
	return ACTIVITIES.find((a) => a.id === id);
}
