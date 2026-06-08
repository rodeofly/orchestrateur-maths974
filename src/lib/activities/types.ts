// Modèle de métadonnées d'une activité de la bibliothèque. Conçu pour des CENTAINES d'items
// multi-sources : on tague contre la taxonomie GS (spine) + facettes, on ne range pas des icônes.
// Cf. docs/BIBLIOTHEQUE.md.
import type { RituelType } from './rituels';

export type ActivitySource =
	| 'gs'
	| 'lambdazef'
	| 'blokaly'
	| 'aljeb974'
	| 'pezali974'
	| 'coopmaths'
	| 'geogebra'
	| 'kahoot'
	| 'video'
	| 'balance'
	| 'whiteboard'
	| 'url';

// Le « type d'écran » — facette nature ; UNE icône par support (≈8-12 max), pas par activité.
export type Support =
	| 'fiche'
	| 'jeu'
	| 'video'
	| 'quiz'
	| 'manipulable'
	| 'tableur'
	| 'geometrie-dyn'
	| 'lien';

export type Comp = 'ch' | 'mo' | 're' | 'ra' | 'ca' | 'co'; // socle DNB
export type Niveau = 'fragile' | 'satisfaisant' | 'tres-satisfaisant' | 'expert';
export type ClasseId = 'cm2' | '6e' | '5e' | '4e' | '3e' | '3e-dnb';

// Les 7 domaines GS + 1 domaine technique transversal. domaineKey = clé canonique (dossier réel).
export const DOMAINES: { key: string; label: string }[] = [
	{ key: '01-nombres-et-calculs', label: 'Nombres et calculs' },
	{ key: '02-grandeurs-et-mesures', label: 'Grandeurs et mesures' },
	{ key: '03-espace-geometrie', label: 'Espace et géométrie' },
	{ key: '04-donnees-probabilites', label: 'Données et probabilités' },
	{ key: '05-proportionnalite', label: 'Proportionnalité' },
	{ key: '06-pensee-informatique', label: 'Pensée informatique' },
	{ key: '07-resolution-problemes', label: 'Résolution de problèmes' },
	{ key: '00-transversal', label: 'Transversal' }
];
export const TRANSVERSAL = '00-transversal';

export interface ActivityMeta {
	// Identité & adressage — STABLE, indépendant de la taxo (un reclassement ne casse aucun parcours).
	id: string; // opaque, namespacé : 'gs:zefor974/01-retour-unite', 'lambdazef'
	source: ActivitySource;
	label: string;
	emoji?: string;
	description?: string;
	kind: 'graded' | 'consult';
	support: Support;
	canonical?: boolean; // préférence inter-sources sous une même étiquette GS

	// Embarquement (réutilise activityUrl() + @maths974/embed).
	embed: {
		originDev?: string;
		originProd?: string;
		path: string; // ex GS : '/automaths/eleve/?ref=zefor974/01-retour-unite'
		mode?: 'iframe' | 'newtab';
		connector?: 'm974' | 'none';
	};

	// Rattachement taxonomique (spine GS). domaineKey TOUJOURS présent (repli 00-transversal).
	taxo: {
		gs?: string[]; // ['GS 24.4'] — range la feuille + badge + recherche
		gsBonus?: string[]; // co-rattachements faibles
		domaineKey: string; // canonique (dossier réel) : '05-proportionnalite' | … | '00-transversal'
		domaineLabel?: string;
		sousTheme?: string;
	};

	// Facettes (toutes des sets ; vides = la facette n'élimine pas l'item).
	competences?: Comp[];
	niveaux?: Niveau[];
	classes?: ClasseId[];
	rituels?: RituelType[];
	keywords?: string[];
	dureeMin?: number;
}
