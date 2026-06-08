// Sources NON-GS déclarées à la main (~1 entrée par app). Ces apps lancent en iframe ;
// la CAPTATION des tentatives viendra quand chacune recevra le pont @maths974/embed (comme
// GS et λ-Zèf l'ont reçu) → en attendant, connector:'none' (elles s'ouvrent, ne remontent pas).
import type { ActivityMeta } from '../types';

const FTOBE = 'https://ftobe-maths974.github.io';
const RODEOFLY = 'https://rodeofly.github.io';

// MathALEA (coopmaths) — exemple d'app TIERCE captée par PONT (Tier 2). Lancée avec
// ?recorder=moodle, elle poste { action:'mathalea:score', resultsByExercice } : on le
// traduit via l'adaptateur ($lib/activities/bridges). Lien « élève » court (format Flo) ;
// `recorder=moodle` active la remontée du score. La sélection d'exercices côté prof viendra.
const MATHALEA_EXO = '/alea/?uuid=bdb18&id=4A10&alea=PHVi&v=eleve&es=22110011&recorder=moodle&iframe=1';

export const APP_ACTIVITIES: ActivityMeta[] = [
	{
		id: 'mathalea',
		source: 'coopmaths',
		label: 'MathALEA — exercices coopmaths',
		emoji: '🎲',
		description: 'Banque d’exercices aléatoires auto-corrigés (coopmaths). Réussites captées par pont.',
		kind: 'graded',
		support: 'quiz',
		embed: { originProd: 'https://coopmaths.fr', path: MATHALEA_EXO, connector: 'bridged' },
		taxo: { domaineKey: '00-transversal', domaineLabel: 'Transversal' },
		competences: ['ca', 'ra'],
		rituels: ['rapido', 'zefor', 'evaluation'],
		keywords: ['coopmaths', 'mathalea', 'exercices', 'aléatoire', 'auto-correction', 'entraînement']
	},
	{
		id: 'aljeb974',
		source: 'aljeb974',
		label: 'Aljeb974 — algèbre par cartes',
		emoji: '🃏',
		description: 'Résoudre des équations en manipulant des cartes (façon DragonBox).',
		kind: 'graded',
		support: 'jeu',
		embed: { originProd: `${FTOBE}/aljeb974/`, path: '', connector: 'none' },
		taxo: { domaineKey: '01-nombres-et-calculs', domaineLabel: 'Nombres et calculs', sousTheme: '8. Algèbre' },
		competences: ['ca', 'ra'],
		rituels: ['probleme', 'zefor'],
		keywords: ['équation', 'algèbre', 'isoler', 'dragonbox', 'inconnue']
	},
	{
		id: 'pezali974',
		source: 'pezali974',
		label: 'Pezali974 — la balance',
		emoji: '⚖️',
		description: 'Résoudre des équations en équilibrant une balance.',
		kind: 'graded',
		support: 'jeu',
		embed: { originProd: `${RODEOFLY}/pezali974/`, path: '', connector: 'none' },
		taxo: { domaineKey: '01-nombres-et-calculs', domaineLabel: 'Nombres et calculs', sousTheme: '8. Algèbre' },
		competences: ['mo', 'ra'],
		rituels: ['probleme'],
		keywords: ['équation', 'balance', 'équilibre', 'isoler', 'inconnue']
	},
	{
		id: 'blokaly974',
		source: 'blokaly',
		label: 'Blokaly974 — programmation par blocs',
		emoji: '🧱',
		description: 'Labyrinthe, tortue, algo, motifs et équations en blocs (Blockly).',
		kind: 'graded',
		support: 'jeu',
		embed: { originProd: `${FTOBE}/blokaly974/`, path: '', connector: 'none' },
		taxo: { domaineKey: '06-pensee-informatique', domaineLabel: 'Pensée informatique' },
		competences: ['ra'],
		rituels: ['zefor', 'divertissement'],
		keywords: ['blockly', 'programmation', 'labyrinthe', 'tortue', 'algorithme', 'motif']
	}
];
