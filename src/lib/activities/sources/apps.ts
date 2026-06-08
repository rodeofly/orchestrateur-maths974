// Sources NON-GS déclarées à la main (~1 entrée par app). Ces apps lancent en iframe ;
// la CAPTATION des tentatives viendra quand chacune recevra le pont @maths974/embed (comme
// GS et λ-Zèf l'ont reçu) → en attendant, connector:'none' (elles s'ouvrent, ne remontent pas).
import type { ActivityMeta } from '../types';

const FTOBE = 'https://ftobe-maths974.github.io';
const RODEOFLY = 'https://rodeofly.github.io';

// MathALEA (coopmaths). ⚠️ coopmaths.fr est derrière Cloudflare : EN IFRAME son challenge
// anti-bot boucle (rechargement ~3 s) et échoue → NON embarquable. On l'ouvre donc dans un
// NOUVEL ONGLET (navigation top-level, le challenge passe) → connector 'none', pas de capture
// auto (Tier 3 : validation déclarative Tier 4 plus tard). Le PONT reste en place côté code
// ($lib/activities/bridges, source 'coopmaths') : réutilisable si un mathaléa EMBARQUABLE
// (auto-hébergé, sans Cloudflare) est branché un jour. Lien « élève » court (format Flo).
const MATHALEA_EXO = '/alea/?uuid=bdb18&id=4A10&alea=PHVi&v=eleve&es=22110011';

export const APP_ACTIVITIES: ActivityMeta[] = [
	{
		id: 'mathalea',
		source: 'coopmaths',
		label: 'MathALEA — exercices coopmaths',
		emoji: '🎲',
		description: 'Banque d’exercices aléatoires auto-corrigés (coopmaths). S’ouvre dans un nouvel onglet.',
		kind: 'graded',
		support: 'quiz',
		embed: { originProd: 'https://coopmaths.fr', path: MATHALEA_EXO, mode: 'newtab', connector: 'none' },
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
