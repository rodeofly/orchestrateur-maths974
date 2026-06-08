# Orchestrateur Maths974

Le **player du professeur metteur en scène** : un seul endroit pour composer, lancer et suivre
des parcours d'activités pédagogiques embarquées (Blokaly974, Aljeb974, GS, Pezali, lambda-zef…).
C'est la **couche 4** de l'écosystème Maths974 (au-dessus du module unitaire `@maths974/competences`
et du connecteur `@maths974/embed`).

> **État : fondation v0 (auth + 5 rôles) + gestion classes/élèves — LIVE sur Supabase.** Le cycle
> prof → provisionnement → connexion élève (sans e-mail) fonctionne en vrai. Restent l'éditeur de
> parcours et l'enregistrement des tentatives réelles (l'archi les anticipe : seams `parcours`/`attempts`).
>
> 📖 **Doc de reprise complète (vision + archi + roadmap) : [HANDOFF.md](HANDOFF.md).**

## Stack & décisions

- **SvelteKit** en `adapter-static` (**SPA pure**, `ssr=false`) → déployée statiquement sur **GitHub Pages**.
  Aucun code serveur : pas de `+page.server.ts`, `+server.ts`, `hooks.server.ts`, `src/lib/server/`.
- **Backend hybride** : **Supabase EU** (auth + Postgres + RLS + rôles) ; **OVH/Moodle** réservés à la
  remontée de notes officielle (LTI), plus tard.
- **5 rôles** : admin · prof · élève · parent · visiteur. v0 = **un rôle par compte** (limite assumée ;
  le schéma `user_roles` garde l'évolution multi-rôle ouverte).
- **Sécurité = RLS Postgres**, jamais le code client. Les gardes côté client ne font que de l'UX/redirection.

## Démarrer

```bash
npm install
cp .env.example .env     # renseigner PUBLIC_SUPABASE_URL / ANON_KEY (région EU)
npm run dev
```

Sans Supabase configuré, l'app build et s'affiche (landing + connexion) ; l'auth réelle nécessite
un projet Supabase (voir [supabase/SETUP.md](supabase/SETUP.md)).

## Scripts

| | |
|---|---|
| `npm run dev` | serveur de dev |
| `npm run build` | build statique (`build/`) |
| `npm run check` | type-check (svelte-check) |
| `npm test` | tests unitaires (rôles, routage) |
| `npm run sync:m974` | resync des paquets vendorés (embed + competences) |

## Structure

```
src/lib/
  auth/        rôles (pur, testé), session réactive, gardes
  supabase/    client (singleton), types DB
  nav/         navigation par rôle + href (base path)
  styles/      tokens + base (design system)
  components/  ui/ (Button, Card, badges, EmptyState, ErrorState, Splash) + shell/AppShell
  m974/        VENDORÉ : connecteur host + module unitaire (ne pas éditer ; npm run sync:m974)
src/routes/
  (public)/    landing, à-propos, confidentialité
  (auth)/      connexion (onglets adulte/élève) — garde requireAnon
  auth/callback  retour magic link
  (app)/       espace connecté (AppShell) — garde requireAuth, puis requireRole par espace
supabase/      migrations (schéma + RLS + hook), tests RLS, SETUP.md
```

## Sécurité / RGPD (public collège, mineurs)

- **RLS deny-by-default**, la **table fait autorité** (helpers `SECURITY DEFINER`, `search_path` verrouillé) —
  le claim JWT n'est qu'un cache d'affichage, jamais une autorité.
- **CSP stricte** (via `kit.csp`), polices auto-hébergées visées, `npm audit` bloquant en CI.
- **Pas d'email perso d'élève** : comptes provisionnés (code classe + PIN, Edge Functions).
- **Pseudonymes opaques** vers les activités ; aucune PII dans l'URL des iframes (cf. `@maths974/embed`).
- EPLE = responsable de traitement, asso = sous-traitant. Voir [supabase/SETUP.md](supabase/SETUP.md) §6.

## Gaps connus (assumés en v0)

- Edge Functions `provision-students` / `student-signin` / `erase-student` : **code fourni** (`supabase/functions/`), reste à **déployer** sur le projet (cf. SETUP §4).
- Tests RLS : ✅ **câblés en CI** via PGlite (Postgres WASM, sans Docker) — `supabase/tests/rls.test.ts` ; variante psql dans `rls.test.sql`.
- Polices Lexend Deca : repli system-ui en v0 (woff2 à auto-héberger).
- Multi-rôle (prof+parent / multi-établissement) : non géré en v0 (mono-rôle).
- Relation au collecteur OVH `competences.maths974.fr` : **décision reportée** — `attempts` est un simple seam.
