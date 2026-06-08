# HANDOFF — Orchestrateur Maths974

> Document de reprise. **À lire en premier** pour reprendre le chantier avec un contexte complet.
> État au **2026-06-07**. Doc écosystème (niveau au-dessus) : `../maths974-competences/HANDOFF.md`.

---

## 0. La vision (ne JAMAIS la perdre de vue)

L'association **Maths974** développe plusieurs applications pédagogiques (supports variés) qui
servent toutes **un seul but : apprendre et être évalué**. L'enjeu du chantier est de les **unifier**
et de donner au professeur un **poste de pilotage** unique — sans tout réécrire.

L'architecture se construit **vers l'extérieur**, en **4 couches** :

```
┌─ Couche 4 : ORCHESTRATEUR (CE dépôt) ───────────────────────────┐
│  Le prof = metteur en scène. Compose/lance des parcours d'activités│
│  embarquées, chronométrés ; suit les classes (multi-matières,      │
│  multi-établissement) ; remplace à terme Pronote ; prépare l'édition│
│  papier des productions numériques. Portails admin/prof/élève/      │
│  parent/visiteur. Worldmap (style Mario 3 / code.org), quêtes       │
│  « Zef Or », récompenses (console rétro limitée).                   │
├─ Couche 3 : BACKEND PARTAGÉ ────────────────────────────────────┤
│  Identité élève, rôles, stockage des tentatives, agrégation de la   │
│  maîtrise, état des classes partagé entre profs. Ici : Supabase EU. │
├─ Couche 2 : CONNECTEUR (`@maths974/embed`) ─────────────────────┤
│  Protocole d'embarquement (iframe + postMessage). Toute app — qu'on │
│  possède ou tierce — se branche avec un adaptateur de ~30 lignes.   │
├─ Couche 1 : MODULE UNITAIRE (`@maths974/competences`) ──────────┤
│  Le LANGAGE COMMUN : référentiel de compétences + `AttemptResult`.  │
│  Clin d'œil de Flo : « un module pour les unifier tous ». ✅ fait.   │
└──────────────────────────────────────────────────────────────────┘
```

**Pourquoi NE PAS tout réécrire** : la diversité des stacks des apps (React, Svelte, Astro,
vanilla) est une *feature*, pas une dette. Tant qu'une app parle le langage commun (couche 1) et
se branche par le connecteur (couche 2), peu importe sa techno. Cela laisse aussi la porte ouverte
aux petites apps externes (lambda-zef, ekoamod, post-turing, console rétro, coopmaths…).

**Cap produit** : l'asso vise un déploiement à l'échelle des établissements du **pays** (La Réunion).
L'orchestrateur doit donc **scaler** : multi-établissement dès le schéma, sécurité par construction.

---

## 1. Où en est-on (état réel, vérifié en prod)

**La fondation v0 (auth + 5 rôles), la gestion classes/élèves ET la SÉANCE ASSIGNÉE tournent en
vrai sur Supabase.** Le prof compose un parcours (catalogue multi-supports) → l'assigne à une classe
→ l'élève le joue (réussites enregistrées) → le prof suit l'activité de la classe. Cycle prouvé :

```
Admin ──crée──> Établissement
  └─ Prof ──crée──> Classe (code de classe) ──provisionne──> Élèves (+ PIN imprimés)
       └─ Élève ──code de classe + identifiant + PIN (sans e-mail)──> entre dans SON espace
```

- ✅ Auth Supabase réelle (prof/parent/admin par e-mail+mot de passe ou magic link ; élève par code+PIN).
- ✅ Rôle/établissement **lus depuis la table** `profiles` (la table fait autorité, pas le JWT).
- ✅ Routage + gardes par rôle ; déconnexion → accueil.
- ✅ RLS cloisonnée (inter-tenant / inter-classe) — **testée en CI** (PGlite, sans Docker).
- ✅ 3 Edge Functions déployées (`provision-students`, `student-signin`, `erase-student`).
- ✅ Runner (couche 2) intégré : page démo `/prof/seance` qui embarque une activité et voit ses
  tentatives remonter en direct.

**Build / type-check / tests : tous verts (18 tests).**

---

## 2. Stack & topologie

| | |
|---|---|
| Frontend | **SvelteKit** (Kit 2.57, Svelte 5 runes, Vite 8, TS) en **`adapter-static` (SPA pure)** |
| Hébergement cible | **GitHub Pages** (statique). Aucun code serveur (pas de `+page.server.ts`, `+server.ts`, `hooks.server.ts`, `src/lib/server/`). |
| Backend | **Supabase EU** (auth + Postgres + RLS + Edge Functions). Projet `bkpbdjelgggpyrfmiehr`. |
| Hybride | Supabase = identité/rôles/données. **OVH/Moodle** réservés (plus tard) à la remontée de notes officielle via **LTI**. |
| Tests | Vitest : logique pure (rôles, routage) + **RLS sur Postgres WASM via PGlite**. |
| Connecteur | `@maths974/embed` (host + protocol) **vendoré** dans `src/lib/m974/`. |
| Module unitaire | `@maths974/competences` (attempt + referential) **vendoré** dans `src/lib/m974/`. |

**Sécurité = RLS Postgres.** Les gardes côté client ne font que de l'UX/redirection ; elles ne
protègent rien. Un attaquant qui désactive le JS ne contourne que l'UX, jamais la RLS.

---

## 3. Architecture frontend

### Groupes de routes (`src/routes/`)
- **`(public)/`** — pas de garde : `/` (landing), `/a-propos`, `/confidentialite`.
- **`(auth)/`** — garde `requireAnon` : `/connexion` (onglets *adulte* e-mail / *élève* code+PIN).
- **`auth/callback`** — retour de magic link → relit la session → route vers l'espace du rôle.
- **`(app)/`** — garde `requireAuth` + `AppShell` ; puis par rôle :
  - `/admin` (`requireRole('admin')`), `/prof`, `/eleve`, `/parent` — chacun gardé.
  - `/prof/classe/[id]` (effectif + provisionnement), `/prof/seance` (démo runner),
    `/parent/consentement`.

### Session (`src/lib/auth/session.svelte.ts`) — **point névralgique**
- Store réactif unique `session` (`status: loading|authed|anon|error`, `role`, `tenantId`,
  `studentKey`, `displayName`).
- `onAuthStateChange` **enregistré une seule fois** ; il tient le store à jour (login/logout/refresh).
- `ensureSessionLoaded()` garantit le 1er `getSession()` (idempotent). `refreshSession()` relit
  (retour de magic link). `signOut()` déconnecte → `setAnon`.
- ⚠️ **Leçon apprise** : les gardes doivent lire l'**état vivant** `session`, jamais un instantané
  figé renvoyé par une promesse mémoïsée (sinon : « collé en visiteur » après déconnexion).

### Gardes (`src/lib/auth/guards.ts`)
`requireAuth` / `requireRole(role)` / `requireAnon` — appelées dans les `+layout.ts`. Lisent `session`.

### Rôles (`src/lib/auth/roles.ts`) — **pur, testé**
`ROLES`, `homeFor`, `roleFromProfile` (**défaut = le moins privilégié, jamais admin**), `canAccess`.

### Design system (`src/lib/styles/`)
Tokens (couleur **par rôle** via `[data-role]`, paliers de maîtrise, hex repris de GS),
base accessible (focus, cibles ≥44px, reduced-motion). Composants maison dans
`src/lib/components/` (`ui/` + `shell/AppShell.svelte` + `runner/RunnerFrame.svelte`).
Police : system-ui en v0 (TODO : auto-héberger Lexend Deca en woff2).

### Connecteur / runner
`RunnerFrame.svelte` encapsule `mount()` du host vendoré : embarque une activité en iframe,
relaie ses événements (`ready/attempt/progress/exit`), envoie des commandes (`pause/reset/timeup`).

---

## 4. Backend Supabase (`supabase/`)

### Schéma (`migrations/0001_init.sql`)
`etablissements`, `profiles` (e-mail nullable, `student_key` opaque, `is_minor`, `parental_consent`,
`extended_processing`), `user_roles` (cumul/multi-tenant préparé), `classes`, `class_teachers`,
`class_students`, `parent_links`, `student_credentials` (PIN haché, **deny-all**). Seams v1 :
`parcours`, `parcours_assignments`, `attempts` (append-only, calque `AttemptResult`). Trigger
`handle_new_user` crée le profil à l'inscription (rôle défaut `eleve`).

### RLS (`migrations/0002_rls.sql`) — **la sécurité réelle**
Deny-by-default. **La table fait autorité, jamais le claim JWT.** Helpers `SECURITY DEFINER STABLE
SET search_path=''` lisant `profiles`/liaisons via `auth.uid()` (`my_role`, `my_tenant`,
`auth_teaches_class/_student`, `auth_is_parent_of`, `auth_is_admin_of`, `class_tenant`). Clause
établissement dans chaque policy (ceinture + bretelles). `student_credentials` = aucune policy.

### Hook (`migrations/0003_auth_hook.sql`)
`custom_access_token_hook` injecte role/tenant dans le JWT — **uniquement pour l'UX au boot**,
jamais une autorité de sécurité (commenté dans le SQL). À activer dans Auth > Hooks.

### Création de classe par le prof (`migrations/0004_prof_classes.sql`)
Le prof crée ses classes dans SON établissement (policy `classes_prof_insert`) et en devient
automatiquement enseignant (trigger `handle_new_class`). Cloisonné par tenant.

### Edge Functions (`functions/`, Deno — déployées)
- `provision-students` : un prof crée un lot d'élèves SANS e-mail (e-mail synthétique
  `<student_key>@eleve.maths974.invalid`, PIN PBKDF2 imprimé une fois). Vérifie l'appelant ET
  qu'il enseigne la classe, **en base**.
- `student-signin` : `{classCode, login, pin}` → vérifie le PIN → renvoie un `token_hash`
  (magic link) que le client confirme via `verifyOtp`. **Déployée avec `--no-verify-jwt`**
  (l'élève n'est pas encore authentifié).
- `erase-student` : effacement RGPD (admin de l'établissement ; cascade FK).
- Partagé : `_shared/util.ts` (CORS, service client, `getCaller`), `_shared/hash.ts` (PBKDF2 + PIN).

### Tests RLS (`tests/rls.test.ts` + `rls.test.sql`)
PGlite (Postgres WASM) applique les vraies migrations + un shim `auth` minimal, puis prouve les
non-accès inter-tenant/inter-classe (prof, élève, parent, admin). **Gate CI sans Docker.**
Variante `psql` dans `rls.test.sql`.

### Runbook
`supabase/SETUP.md` (région EU, hook, URL de callback, déploiement des functions, RGPD).
`supabase/setup_all.sql` = les migrations concaténées (installation fraîche en un coller).

---

## 5. Contrat RGPD / sécurité (public collège, mineurs)

Issu d'un **audit adversarial** (workflow multi-agents). Règles **appliquées** dans le code :
- **RLS = table**, jamais le claim. Helpers `SECURITY DEFINER`, `search_path` verrouillé.
- **Pas d'e-mail perso d'élève** ; pseudonyme **opaque** (`student_key`) vers les activités ;
  **aucune PII dans l'URL d'iframe** (le connecteur n'y passe que `URL_SAFE_KEYS`).
- **CSP stricte** (`kit.csp`), `referrerPolicy=no-referrer` sur les iframes, `npm audit` en CI.
- `student_credentials` deny-all ; rôle défaut = le moins privilégié.
- Hébergement **EU**.

**Responsabilités** : l'EPLE est responsable de traitement, l'asso **sous-traitant** (accord art. 28,
registre art. 30, information des familles). `profiles.extended_processing` (défaut OFF) = gating du
traitement étendu, à imposer au lancement d'une activité.

**À durcir AVANT de vrais élèves** : restreindre `Access-Control-Allow-Origin` des Edge Functions ;
rate-limit anti-bruteforce sur `student-signin` ; brancher le gating consentement.

---

## 6. Lancer / développer / déployer

```bash
npm install
cp .env.example .env     # PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY (= publishable key, région EU)
npm run dev              # dev
npm run check            # type-check
npm test                # tests (rôles, routage, RLS via PGlite)
npm run build            # build statique -> build/
npm run sync:m974        # resync des paquets vendorés (embed + competences)
```

**Clés Supabase (nouveau format)** : *Publishable* `sb_publishable_…` = anon (→ `PUBLIC_SUPABASE_ANON_KEY`,
sûre côté navigateur car RLS) ; *Secret* `sb_secret_…` = service_role (Edge only, **jamais** exposée).

**Déploiement — LIVE (2026-06-08)** :
- Orchestrateur : **https://rodeofly.github.io/orchestrateur-maths974/** (repo `rodeofly/orchestrateur-maths974`, public ;
  secrets `PUBLIC_SUPABASE_*` posés ; `.github/workflows/{ci,deploy}.yml` → CI + Pages ; `BASE_PATH=/orchestrateur-maths974` ;
  `deploy.yml` copie `index.html`→`404.html` pour les deep links SPA).
- Activités prod : **λ-Zèf v2** = https://rodeofly.github.io/VicBret974/ (repo `rodeofly/VicBret974`) ;
  **GS** = https://automaths.maths974.fr/ (pont mergé sur `main` de `rodeofly/GS.C4.2026.Maths974` → publie vers `ftobe-maths974/maths`).
- `gh` est authentifié `rodeofly` (non membre de `ftobe-maths974`) → tout sous `rodeofly`, transférable à l'orga plus tard.
- À faire côté Flo : ajouter le redirect URL Supabase `https://rodeofly.github.io/orchestrateur-maths974/auth/callback` (magic link).

---

## 7. Décisions (avec justification)

| Décision | Pourquoi |
|---|---|
| SvelteKit SPA static + GitHub Pages | Cohérent écosystème (Svelte), zéro serveur à maintenir, scalable/gratuit. |
| Backend hybride Supabase + OVH/Moodle | Supabase = auth/RLS/rôles clés-en-main ; OVH/Moodle = notes officielles (LTI), souveraineté FR. |
| RLS table-autoritaire | Empêche tout franchissement de tenant via un claim JWT falsifié. |
| Mono-rôle par compte en v0 | Simplicité ; `user_roles` garde l'évolution multi-rôle ouverte. |
| Relation au collecteur OVH `competences.maths974.fr` **reportée** | `attempts` est un simple seam ; on tranchera (sink unifié vs coexistence) au moment du runner. |
| Connecteur/competences **vendorés** (copiés) | Paquets non publiés sur npm ; resync via `npm run sync:m974`. Risque de drift assumé. |
| `Database = any` (placeholder) | Tant que `database.types.ts` n'est pas régénéré depuis le schéma. |

---

## 8. Roadmap (v0 → v1 → v2)

**v0 — FAIT** : auth + 5 rôles, RLS testée, classes + provisionnement + connexion élève, runner démo.

**v1 — prochaines briques**
- [ ] **Mettre en ligne** : push GitHub + secrets → CI + Pages.
- [x] **Runner élève + catalogue** : `/eleve/jouer` liste le **catalogue d'activités**
      (`src/lib/activities/catalog.ts` — λ-Zèf + fiches GS zefor), l'élève en choisit une, la joue
      embarquée, et chaque réussite est **enregistrée** (RLS `student_id = auth.uid()`, testé). Le
      même catalogue alimentera l'éditeur de parcours. URL dev/prod via `import.meta.env.DEV`.
      Reste : déployer les activités (λ-Zèf grenier, GS) ; aujourd'hui en localhost.
- [x] **Dashboard « Mes compétences » (élève)** : `/eleve/competences` agrège les `attempts` via le référentiel (`tierFromRate`).
- [x] **État de la classe (prof)** : la page classe `/prof/classe/[id]` montre les tentatives récentes
      des élèves (RLS `attempts_teacher`, testé) → le prof vérifie « qui a fait quoi ». La page
      `/prof/seance` est renommée **« Aperçu activité »** (outil de test qui N'enregistre PAS — clarifié).
- [x] **Panneau admin « Utilisateurs & rôles »** (`/admin/utilisateurs`) : lister les ADULTES du tenant,
      changer un rôle, **inviter** un prof/parent par e-mail. Écritures privilégiées via Edge Functions
      `invite-user`/`set-user-role` + fonction SQL atomique `admin_set_role` (migration **0006**), conçues
      d'après un **audit adversarial** (9 must-fix : tenant lu en base, anti-vol de compte, frontière
      mineur↔adulte, dernier-admin, validation stricte, redirect en dur, audit log `admin_audit`). Testé
      en PGlite. **Pas d'impersonation** (distinct de « Voir comme… »). Reste should-fix : rate-limit invite,
      CORS restreint, session-invalidation (mitigée car la session lit le rôle depuis la TABLE, pas le claim).
- [x] **Pont GS → orchestrateur** : GS (automaths/zefor) émet son `AttemptResult` par
      `postMessage` quand il est embarqué (`../GS.C4.2026.Maths974/src/utils/embed/` +
      auto-mapping thème→macro pour combler le trou d'annotation `|comp:`). Embarquer une
      fiche : `https://automaths.maths974.fr/automaths/eleve/?ref=<slug>` (ex. `ref=zefor974/03-tableur`).
      Le **catalogue d'activités** (`src/lib/activities/catalog.ts`) inclut des fiches GS zefor.
      Reste : déployer GS (le pont est dans son code, pas encore en prod).
- [x] **Éditeur de parcours + lecteur élève** : `/prof/parcours` (le prof compose une séquence depuis
      le catalogue → `parcours.steps` jsonb → assigne à une classe via `parcours_assignments`) ;
      `/eleve` liste les parcours assignés ; `/eleve/parcours/[id]` enchaîne les étapes (RunnerFrame)
      et enregistre les `attempts`. RLS `0005` : l'élève ne lit que SON parcours assigné (testé).
- [x] **Modèle de RITUELS (méthode Maths974)** : `src/lib/activities/rituels.ts` — une séance =
      suite de rituels typés (rapido/zéfor/problèmes/éval/bilan/divertissement) avec compétences socle ;
      `parcours.steps` = `SeanceStep[]` (`{rituel, activities[]}`), `normalizeSteps` tolère l'ancien
      format. L'éditeur compose par rituels, peut **publier une séance comme modèle Maths974**
      (`is_published`) et **dupliquer** un modèle. Le lecteur joue les activités DANS leur rituel et
      **fusionne les compétences du rituel** dans la tentative (`withRituelCompetences`). Pas de migration.
      Reste : hiérarchie année/période/séquence.
- [x] **Cockpit live (v1)** : `/prof/cockpit` — fond tableau blanc ou activité embarquée + barre d'outils
      flottante. `src/lib/components/cockpit/` : **Chrono** (minuteur/chrono), **Tirage** (dé + élève/groupes
      depuis l'effectif), **Calculatrice** (machine à états, sans eval → CSP-safe), **Annotation** (canvas
      transparent au-dessus, stylo/gomme + **rapporteur**/**équerre** déplaçables-pivotables). Panneaux
      déplaçables (`src/lib/actions/draggable.ts`), **plein écran** pour projeter. **Mode séance live** :
      le prof projette une de ses séances (« Mes séances ») et enchaîne les rituels (barre ‹ ›, rituel +
      compétences + durée indicative `dureeMin` + étape i/n). Reste : compas, sauver l'état du tableau,
      chrono qui s'arme auto sur la durée du rituel.
- [ ] **Durcissement RGPD** : CORS Edge restreint, rate-limit `student-signin`, gating consentement.
- [ ] Régénérer `database.types.ts` (typage réel des requêtes).
- [ ] Auto-héberger Lexend Deca (woff2).

**v2 — vision produit**
- [ ] **Worldmap** de parcours (style Mario 3 / code.org) + mode quête « Zef Or » (maths cachés,
      récompenses : console rétro limitée 2 min × 2/séance).
- [ ] **Anti-Pronote** : partage de l'état des classes entre profs, multi-matières.
- [ ] **Édition papier** des productions numériques (style AppDrive/Slides).
- [ ] **Remontée LMS** : LTI vers le relais OVH → Moodle (`moodle.maths974.fr`).
- [x] **« Voir comme… » (simulation de rôle, façon Moodle)** : le même utilisateur simule un rôle
      INFÉRIEUR (admin→prof→élève→visiteur, `SIM_LADDER`) pour inspecter l'interface/expérience de ce
      rôle ; rétablissable (bannière globale « Rétablir mes droits »). 100% client : un **rôle effectif**
      (`session.simulatedRole`, `effectiveRole()`) pilote routage/gardes/nav/chrome, borné à la DESCENTE.
      Aucune élévation possible et la **RLS reste le garde-fou** (même `auth.uid()`). Pas d'impersonation
      d'utilisateur (décision Flo : « on ne change pas d'utilisateur »). Sélecteur dans l'AppShell.
- [ ] **Multi-rôle / multi-établissement** (un humain prof+parent, ou prof sur 2 EPLE).
- [ ] **Raccordement d'apps tierces** : adaptateur « bridged » pour coopmaths/MathALEA (à vérifier :
      postMessage ?). Khan = opaque + frame-bloqué → lien externe + validation manuelle.

---

## 9. Repères de code (où brancher quoi)

- **Auth/session** : `src/lib/auth/{roles,session.svelte,guards}.ts` (rôles purs + état vivant).
- **Data client** : `src/lib/supabase/{client,database.types}.ts`.
- **Navigation par rôle** : `src/lib/nav/routes.ts` (`NAV_BY_ROLE`, `resolveHref` gère le base path).
- **Embarquer une activité** : `src/lib/components/runner/RunnerFrame.svelte` + `src/lib/m974/host.js`.
- **Émettre/typer une tentative** : `src/lib/m974/{attempt,referential}.js` (module unitaire vendoré).
- **Schéma/RLS** : `supabase/migrations/` ; toute nouvelle table → RLS deny-by-default + test PGlite.
- **Backend privilégié** : `supabase/functions/` (service_role, vérifier l'appelant EN BASE).

---

## 10. Liens & écosystème

- Connecteur (contrat couche 2) : `../maths974-embed/README.md` + `test/host-demo.html`.
- Module unitaire (contrat couche 1) : `../maths974-competences/{README,SPEC,HANDOFF}.md`.
- App-preuve du connecteur : `../lambda-zef/grenier/` (émet un `AttemptResult` en fin de leçon).
- Moodle cible : `https://moodle.maths974.fr/` · Relais/collecteur OVH : `../OVH/www/`.
- Projet Supabase : `bkpbdjelgggpyrfmiehr` (région EU).
