# Client app starter

A starter for small client web apps: an owner signs in, works on her own records, and shares one record with a guest through a secret link, with no account. It ships the parts every such app needs, already tested, and one small example resource (`projects`) to replace with the client's domain.

Extracted 2026-10-17 from a client app built 2026-10-16, cleaned in review.

## Stack

- **Frontend:** Vite, React 19 and TypeScript (strict), React Router, in `app/`.
- **Backend:** [Convex](https://convex.dev): the database, live queries, file storage and Convex Auth (email and password).
- **Email:** [Resend](https://resend.com) for the password-reset code.
- **Hosting:** Cloudflare Workers static assets in SPA mode, deployed with Wrangler (no Worker script).
- **Tests:** Vitest (with convex-test for the Convex functions) and Playwright (Chromium) on a local anonymous Convex backend.

## What is in it

| Module                                                                                                                                                       | Where                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Auth: email and password, an owner allowlist (`OWNER_EMAILS`, checked at sign-up and on every call), password reset by a Resend code, clear sign-in problems | `convex/auth.ts`, `convex/lib/owners.ts`, `convex/lib/signIn.ts`, `convex/accounts.ts`, `convex/ResendOTPPasswordReset.ts`, `src/auth/` |
| Access layer: `ownerQuery`, `ownerMutation`, `projectQuery`, `projectMutation`; the share-token pattern (`/p/<token>`, revocable)                            | `convex/lib/functions.ts`, `convex/lib/access.ts`, `convex/share.ts`, `src/share/`                                                      |
| Migrations: `@convex-dev/migrations`, with one example migration                                                                                             | `convex/migrations.ts`                                                                                                                  |
| Validators as the single source of the data shapes; the test-functions guard and owner cleanup over a configured table list                                  | `convex/lib/validators.ts`, `convex/testing.ts`, `convex/lib/ownerData.ts`                                                              |
| UI kit: tokens, components, the `/ui-kit` page, the `ui-kit` agent skill                                                                                     | `src/ui/`, `.claude/skills/ui-kit/SKILL.md`                                                                                             |
| In-app feedback: a dialog with a pasted screenshot and the page's context, a `/feedback` inbox, a triage script                                              | `convex/feedback.ts`, `src/feedback/`, `scripts/feedback.ts`                                                                            |
| Export and import of one record as a versioned JSON file, behind an adapter; a whole-database backup script                                                  | `convex/lib/backup.ts`, `convex/backup.ts`, `src/backup/`, `scripts/backup.ts`                                                          |
| Wrangler SPA deploy                                                                                                                                          | `wrangler.jsonc`, `npm run deploy`                                                                                                      |
| Playwright harness: its own local anonymous backend in `app/.e2e/`, refuses cloud deployments, a fresh test owner per test                                   | `e2e/`                                                                                                                                  |
| Checks: format, typecheck, strict lint rules, English only, no raw colours, knip, tests                                                                      | `npm run check`                                                                                                                         |
| Generic helpers: errors, error boundary, upload, timed state, undo history, platform, dates                                                                  | `src/lib/`                                                                                                                              |
| The example resource: `projects` (ownerId, name, shareToken), the list, the owner's page, the share-link page                                                | `convex/projects.ts`, `src/projects/`                                                                                                   |

## Start a new app from it

1. Copy the folder (without `.git`, `app/node_modules`, `app/.e2e`) and run `git init`.
2. Rename the app in `app/convex/lib/appConfig.ts`: `APP_NAME`, `BRAND` and `BACKUP_FORMAT` (choose the format name once, before the first real export). Also `name` in `app/package.json` and `app/wrangler.jsonc`, the `<title>` in `app/index.html`, and the placeholder icons in `app/public/`.
3. Install and create your own Convex project, on your own Convex account:

   ```sh
   cd app
   npm install
   npx convex login status   # check it is the account you mean, before anything is created
   npx convex dev            # creates the project and its dev deployment, writes .env.local
   npx @convex-dev/auth      # sets JWT_PRIVATE_KEY and JWKS on the dev deployment
   ```

4. Set the dev deployment's environment variables with `npx convex env set NAME value` (names only here; values never go into the repo):
   - `SITE_URL`: `http://localhost:5173` in dev, the app's URL in prod.
   - `OWNER_EMAILS`: comma-separated emails allowed to sign up. Unset means nobody can.
   - `AUTH_RESEND_KEY`: a Resend API key with sending access, restricted to your domain. Set it with `npx convex env set AUTH_RESEND_KEY` and no value, so the CLI asks for it and it stays out of your shell history.
   - `AUTH_EMAIL_FROM`: the reset email's sender, such as `My App <no-reply@your-domain>`.
   - `ALLOW_TEST_FUNCTIONS=true`: dev only, for `npm run prove:owner`. Never on prod.
5. Resend: add and verify the sending domain (its DNS records), then create the key for that domain only. Until the domain is verified, reset emails fail with "Couldn't send the email right now."
6. Replace the example: change `projectFields` in `convex/lib/validators.ts`, `convex/projects.ts` and `src/projects/`, keep every public function on the builders in `convex/lib/functions.ts`, and add every owner-scoped table to `convex/lib/ownerData.ts` (a test fails until you do).

## Run

```sh
cd app
npx convex dev   # keeps the dev deployment's functions in sync
npm run dev      # http://localhost:5173 ; the kit is at /ui-kit once signed in
```

## Check and test

```sh
npm run check    # format:check, typecheck (app and convex/), lint, check:english, check:colors, knip, Vitest
npm test         # Vitest only
npm run build    # typecheck and production build
```

## End-to-end tests

Playwright, Chromium only, in `e2e/`: one spec each for auth, share, feedback and backup. They run against their own local anonymous Convex backend and a Vite server, never against a cloud deployment.

```sh
npx playwright install chromium   # once
npm run e2e                       # starts the backend and Vite, runs the suite, stops them
npm run e2e:backend               # optional: keep the backend up between runs
E2E_BACKEND_PORT=3580 E2E_SITE_PORT=3581 E2E_VITE_PORT=5580 npm run e2e   # other ports
```

The Convex CLI runs in `app/.e2e/` (gitignored), so the suite never writes `app/.env.local`. It refuses to run if `app/.e2e/.env.local` names a cloud deployment, the one `app/.env.local` names, or one listed in `E2E_SHARED_DEPLOYMENTS` (comma-separated deployment names, from your shell). The first run makes the local deployment and sets its Convex Auth keys, `SITE_URL`, `OWNER_EMAILS` (one test owner) and `ALLOW_TEST_FUNCTIONS=true`. Each test signs up its own `test-owner+e2e-…@example.com` and deletes it afterwards.

## Deploy

Backend on Convex prod first, then the frontend on Cloudflare Workers. The full steps and gates are in [docs/deploy-checklist.md](docs/deploy-checklist.md).

1. Create `app/.env.production` (gitignored) with your prod URL only. It is public (the build ships it to every browser), but it names your deployment, so it stays out of the template:

   ```sh
   VITE_CONVEX_URL=https://<prod-deployment-name>.convex.cloud
   ```

2. Deploy:

   ```sh
   npm run deploy:convex   # convex deploy: pushes convex/ to prod (asks to confirm)
   npm run deploy:web      # vite build against .env.production, then wrangler deploy
   npm run deploy          # both, in that order
   ```

## Backup

- **Export project** (on a project's page, owner only) downloads one JSON file: the versioned envelope `{format, version, exportedAt, data}`. **Import project** on the projects list makes a new project from it, with its own share link. Another resource plugs in with its own `BackupAdapter` (`src/backup/adapter.ts`).
- `npm run backup:prod` exports the whole prod database with its files to `app/backups/<date>.zip` (gitignored: it holds real client data and auth tables; keep it off shared machines).
- `npm run feedback -- --prod` prints new feedback as Markdown for triage.

## Optional modules, not included

- **PDF export:** jsPDF and svg2pdf.js, embedded static font subsets, and a page fit (Letter, orientation by the drawing's shape), made in the browser from an SVG element. Left out of v0.1.0; add it as `src/pdf/` with an svg-in, PDF-out API and its own print palette (CSS variables don't resolve in a PDF).

## Docs

- [docs/architecture.md](docs/architecture.md): stack, data, access rules, code map, conventions.
- [docs/deploy-checklist.md](docs/deploy-checklist.md): Convex prod plus Workers, steps, gates and plan limits.
- [CLAUDE.md](CLAUDE.md): the code rules for agents.
