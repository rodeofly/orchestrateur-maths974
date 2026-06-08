// Catalogue d'activités embarquables — le registre déclaratif que le RUNNER et
// (à venir) l'ÉDITEUR DE PARCOURS consomment. Chaque activité se branche via le
// connecteur @maths974/embed (iframe + postMessage) et émet un AttemptResult.
//
// URL dev vs prod : on choisit l'origine selon import.meta.env.DEV (les apps
// tournent en localhost en dev, sur leurs domaines en prod).

export type ActivitySource = 'lambdazef' | 'gs';

export interface Activity {
	id: string; // identifiant stable (clé de parcours)
	label: string;
	emoji?: string;
	description?: string;
	source: ActivitySource;
	kind: 'graded' | 'consult';
	originDev: string; // origine en développement (localhost)
	originProd: string; // origine en production
	path: string; // chemin + query (ex. GS : /automaths/eleve/?ref=<slug>)
}

const LAMBDAZEF = {
	originDev: 'http://localhost:5173',
	originProd: 'https://rodeofly.github.io/VicBret974' // λ-Zèf v2 (grenier) déployé, émet au connecteur
};
const GS = {
	originDev: 'http://localhost:4321',
	originProd: 'https://automaths.maths974.fr'
};

// Une fiche GS = /automaths/eleve/?ref=<slug>
const gsFiche = (slug: string) => `/automaths/eleve/?ref=${slug}`;

export const ACTIVITIES: Activity[] = [
	{
		id: 'lambdazef',
		label: 'λ-Zèf — les œufs alligator',
		emoji: '🐊',
		description: 'Calcul fonctionnel (λ-calcul) en jouant à nourrir les alligators.',
		source: 'lambdazef',
		kind: 'graded',
		originDev: LAMBDAZEF.originDev,
		originProd: LAMBDAZEF.originProd,
		path: '/'
	},
	{
		id: 'gs:zefor974/01-retour-unite',
		label: 'Retour à l’unité (Zefor)',
		emoji: '🍎',
		description: 'Proportionnalité — méthode du retour à l’unité (GS 24.4).',
		source: 'gs',
		kind: 'graded',
		originDev: GS.originDev,
		originProd: GS.originProd,
		path: gsFiche('zefor974/01-retour-unite')
	},
	{
		id: 'gs:zefor974/02-glisse-nombre',
		label: 'Glisse-nombre (Zefor)',
		emoji: '🔢',
		description: 'Multiplier / diviser par 10, 100, 1000 (GS 3.11–3.12).',
		source: 'gs',
		kind: 'graded',
		originDev: GS.originDev,
		originProd: GS.originProd,
		path: gsFiche('zefor974/02-glisse-nombre')
	},
	{
		id: 'gs:zefor974/03-tableur',
		label: 'Tableur (Zefor)',
		emoji: '📊',
		description: 'Vocabulaire, formules et DNB sur tableur (GS 19.3).',
		source: 'gs',
		kind: 'graded',
		originDev: GS.originDev,
		originProd: GS.originProd,
		path: gsFiche('zefor974/03-tableur')
	},
	{
		id: 'gs:zefor974/03-volume-cubes',
		label: 'Volume de cubes (Zefor)',
		emoji: '🧊',
		description: 'Volume du pavé droit, formule produit (GS 12.4).',
		source: 'gs',
		kind: 'graded',
		originDev: GS.originDev,
		originProd: GS.originProd,
		path: gsFiche('zefor974/03-volume-cubes')
	}
];

export function activityUrl(a: Activity): string {
	const origin = import.meta.env.DEV ? a.originDev : a.originProd;
	return origin + a.path;
}

export function getActivity(id: string): Activity | undefined {
	return ACTIVITIES.find((a) => a.id === id);
}
