# Architecture

A skeleton: fill each section in for the app you build. The text below describes the starter as shipped (v0.1.0) and its one example resource, `projects`.

## Stack

| Part           | Choice                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Vite, React 19, TypeScript (strict), React Router, in `app/`. UI from the kit in `app/src/ui`.                                           |
| Backend        | Convex: database, live queries (an owner and a guest see each other's edits live), file storage.                                         |
| Owner sign-in  | Convex Auth, email and password. Only the emails on the `OWNER_EMAILS` env var can sign up, and the list is checked again on every call. |
| Guest access   | A secret link `/p/<token>`, with no sign-up, scoped to one project. The owner can make a new token, which revokes the old link.          |
| Password reset | Convex Auth `Password({ reset })`: an 8-digit code sent by Resend from `AUTH_EMAIL_FROM`, on a domain verified in Resend.                |
| Migrations     | `@convex-dev/migrations` from the first release, so schema changes on real data go through a migration (`convex/migrations.ts`).         |
| Hosting        | `npx convex deploy`, then the frontend on Cloudflare Workers static assets (SPA mode) with Wrangler.                                     |
| Tests          | Vitest and convex-test (in-memory backend); Playwright on a local anonymous Convex backend.                                              |

## Data (Convex tables)

- `projects` {ownerId, name, shareToken}: the example resource. Indexes `by_owner`, `by_shareToken`.
- `feedback` {ownerId, type: "broken" | "feature" | "question", message, screenshotId?, context: {path, projectId?, appVersion, userAgent, viewport, time, timeZone}, createdAt, status: "new" | "done"}. Not per project: every owner sees every entry. A screenshot is a PNG or JPEG in Convex storage, at most 3 MB and 2400 px on its longest side; the browser shrinks a bigger one before it uploads.
- The Convex Auth tables (`authTables`).

Every shape comes from `convex/lib/validators.ts` (and `convex/lib/feedback.ts`): the schema, the functions' args and `returns`, and the types `src` uses (`Infer<>`). Every table that holds an owner's data is listed in `convex/lib/ownerData.ts`.

## Access rules

Every public Convex function is declared with a builder from `convex/lib/functions.ts`, which applies the rules in `convex/lib/access.ts`. ESLint forbids the raw `query` and `mutation` in function files.

- `ownerQuery` / `ownerMutation`: a signed-in owner, or "Not allowed". They add `ctx.ownerId` and `ctx.access`.
- `projectQuery` / `projectMutation`: the owner or a guest. They take the optional `shareToken` arg and add `ctx.access`, whose `find*` methods return null and `require*` methods throw "Not allowed"; `*OwnedProject` refuses a guest. With a token the caller is that project's guest and nobody else, even when an owner is signed in.
- `publicQuery`: `accounts.status` (before sign-in) and `projects.getByShareToken` (the project without its `ownerId`).
- Internal functions (`internalQuery`, `internalMutation`): `feedback.listForTriage` for `npm run feedback`, and `convex/testing.ts`, which throws unless the deployment sets `ALLOW_TEST_FUNCTIONS=true`.

An owner is a signed-in user whose email is on `OWNER_EMAILS`, checked on every call (`findOwner`): taking an email off the list locks that account out at once, while the share links to its projects keep working.

`accounts.status` exists because prod masks auth errors as "Server Error": after a failed sign-in or sign-up the form asks it why (`src/auth/authProblems.ts`). It answers only `missing`, `locked` or `ready`. An email off the allowlist answers `missing`, like an owner's email with no account yet, so the public query doesn't reveal who is on the list; sign-up then refuses it. The accepted trade-off: anyone can learn whether an email has a usable account, which the form needs to tell a wrong password from a missing account.

A resource that belongs to a project gets its own `find*`/`require*` pair in `Access`, which loads the row and checks its project with `findProject`.

## Code map (`app/`)

### Environment and scripts

`npx convex dev` writes `.env.local` (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`), gitignored. `.env.production` (gitignored, made by hand) holds the prod `VITE_CONVEX_URL`, which `vite build` reads. Backend settings live in the deployment's env, never in a file: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `OWNER_EMAILS`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`; dev only `ALLOW_TEST_FUNCTIONS`. `vite.config.ts` defines `__APP_VERSION__`, the git short commit of the build, sent with every feedback entry.

| Script                | Does                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`       | `format:check`, `typecheck` (app and `convex/`), `lint`, `check:english`, `check:colors`, `knip`, `npm test` |
| `npm run e2e`         | Playwright on its own local anonymous backend; state in `app/.e2e/`                                          |
| `npm run build`       | typecheck and production build                                                                               |
| `npm run deploy`      | `deploy:convex`, then `deploy:web`                                                                           |
| `npm run backup:prod` | `convex export` of prod with its files to `backups/<date>.zip`                                               |
| `npm run feedback`    | new feedback as Markdown (`-- --prod`, `-- --all`)                                                           |
| `npm run prove:owner` | optional smoke test of the sign-up gate and the owner's path on the dev deployment                           |

### Where things are

- `convex/schema.ts`, `convex/lib/validators.ts`: the data.
- `convex/lib/functions.ts`, `convex/lib/access.ts`: the access builders and rules. A function file only declares functions; its helpers live in `convex/lib/<topic>.ts`, and its `returns` validator pins what the client receives.
- `convex/projects.ts`, `convex/share.ts`: the example resource and its share token.
- `convex/auth.ts`, `convex/accounts.ts`, `convex/ResendOTPPasswordReset.ts`, `convex/lib/owners.ts`, `convex/lib/signIn.ts`: sign-in.
- `convex/feedback.ts`, `convex/lib/feedback.ts`, `convex/lib/feedbackEntries.ts`: feedback.
- `convex/backup.ts`, `convex/lib/backup.ts`: the export envelope and the example's export and import.
- `convex/testing.ts`, `convex/lib/ownerData.ts`: test owners and their cleanup.
- `src/App.tsx`: the routes (`/`, `/project/:id`, `/p/:token`, `/feedback`, `/ui-kit`) inside an error boundary.
- `src/projects/`, `src/share/`, `src/backup/`, `src/feedback/`, `src/auth/`: the features, on the kit.
- `src/ui/`: the UI kit; `/ui-kit` shows every component in its states and needs a signed-in owner.
- `src/lib/`: generic helpers that import only `lib/` and `ui/` (lint-enforced).
- `e2e/`: the specs and `e2e/support/` (ports, the local deployment guard, owners, fixtures, page helpers).

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`; no `any`, no `v.any()`, no `!` outside tests (use `defined()` in a test).
- ESLint `strictTypeChecked` with type-aware parsing; import order; files at most 400 lines, functions 120, complexity 15 (tests are exempt from the size rules); raw `button`/`input`/`select`/`textarea` and deep kit imports only inside `src/ui/`; `src/ui/` and `src/lib/` import no feature code; English only. An `eslint-disable` carries its reason.
- Errors: the server throws `ConvexError` with a sentence for the user, the client throws `UserError`; components show them with `useErrorState` (inline) or `useErrorToast`, which also log to the console.
- A kind is a string enum; an outside string becomes one through `enumGuard` (`src/lib/enums.ts`).
- Tests select by role, label and visible text only.
