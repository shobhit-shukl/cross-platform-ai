# CrossPost AI

A pnpm monorepo with a NestJS API and a Next.js dashboard.

- **Milestone 1**: app login + "Connect YouTube" via official Google OAuth 2.0.
- **Milestone 2**: `/create` — select a video, publish it to the connected YouTube
  channel via the real YouTube Data API `videos.insert`.

No scraping, no passwords collected, tokens never touch the frontend.

```
apps/
  api/   NestJS backend  — http://localhost:5000
  web/   Next.js frontend — http://localhost:3000
```

## 1. Prerequisites

- Node.js 20+, pnpm, Docker Desktop (for local Postgres)
- A Google Cloud project (free) — see setup below

## 2. Google Cloud Console setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a
   project (or pick an existing one).
2. **Enable the API**: APIs & Services → Library → search "YouTube Data API v3" → Enable.
3. **Configure the consent screen**: APIs & Services → OAuth consent screen.
   - User type: External.
   - Fill in app name, support email, developer contact email.
   - Scopes: add `.../auth/youtube.readonly`.
   - Test users: add your own Google account (required while the app is in "Testing"
     status — see the note below).
4. **Create credentials**: APIs & Services → Credentials → Create Credentials →
   OAuth client ID.
   - Application type: **Web application**.
   - Authorized redirect URIs: `http://localhost:5000/auth/youtube/callback`
   - (Authorized JavaScript origins isn't required for this server-side flow.)
5. Copy the generated **Client ID** and **Client Secret** into `apps/api/.env`.

> **Testing-mode limitation**: while your OAuth consent screen is in "Testing" status,
> Google issues refresh tokens that expire after **7 days**, and only accounts listed
> as test users can complete the flow. Neither is a bug in this code — it's Google
> policy. Publish the app (or verify it) before relying on long-lived refresh tokens
> in production.

## 3. Environment variables

Copy the example files and fill in the blanks:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

`apps/api/.env` — already pre-filled with generated dev secrets for `JWT_SECRET`,
`OAUTH_STATE_SECRET`, and `TOKEN_ENCRYPTION_KEY`; only `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are left for you to fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local Docker by default) |
| `FRONTEND_URL` / `API_URL` | CORS + redirect targets |
| `JWT_SECRET` | Signs the app login session cookie |
| `OAUTH_STATE_SECRET` | Signs the OAuth `state` param (CSRF binding) — must differ from `JWT_SECRET` |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key, AES-256-GCM encryption of stored tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console, step 2 above |
| `GOOGLE_REDIRECT_URI` | Must exactly match the URI registered in Google Cloud Console |

The API refuses to boot if any of these are missing or malformed (validated with zod
at startup) — regenerate secrets with `openssl rand -hex 32` if you ever need new ones.

`apps/web/.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL the browser uses to call the backend |

## 4. Running locally

```bash
pnpm install
pnpm db:up                 # starts Postgres in Docker
pnpm prisma:migrate        # applies the schema (first run only, or after schema changes)
pnpm dev                   # runs both API (:5000) and web (:3000)
```

Or run them individually: `pnpm dev:api`, `pnpm dev:web`.

`pnpm prisma:studio` opens a DB browser at http://localhost:5555 if you want to inspect
`social_accounts` rows directly.

## 5. Testing the full OAuth flow

1. Open http://localhost:3000 → redirects to `/login`.
2. Register a new account (email + password ≥ 8 chars).
3. You land on `/dashboard` → **Connected Accounts** → YouTube shows "Not connected".
4. Click **Connect YouTube** → redirected to Google's real consent screen.
5. Sign in with a Google account **listed as a test user** (see step 3 of the Cloud
   Console setup) and accept the YouTube permission.
6. Google redirects back through the backend, which redirects you to
   `/dashboard?connection=success` → the YouTube row now shows **Connected ✓**, the
   channel name, and channel ID.
7. Click **Disconnect** → the row reverts to "Not connected" (this also calls Google's
   token revoke endpoint, best-effort).

**Negative paths worth trying:**
- Click "Connect YouTube" and then click **Cancel** on Google's consent screen →
  dashboard shows a "You declined the Google permission request" banner.
- Refresh `/dashboard?connection=success` manually → the banner does not reappear
  (the URL is cleaned after first render).
- Log in as a second account and confirm it starts with no connected accounts (each
  user's connections are isolated).

I also verified the backend independently via `curl`, including cookie-based sessions,
the signed OAuth `state` round-trip, every callback error branch (`access_denied`,
missing params, tampered/expired state, failed token exchange), ownership checks on
disconnect (a second user gets 404 trying to delete someone else's connection, not
403 — so account IDs aren't enumerable), and confirmed `GET /api/social-accounts`
never returns `accessToken`/`refreshToken` in the response body.

I don't have a connected browser in this environment to click through the UI directly,
so the frontend is verified via a clean `next build` (typecheck + static generation,
no errors) and manual trace of the client logic — worth a click-through on your end
before you fully trust the polish, though the wiring underneath is solid.

## 6. What's implemented

**Files created:**
- `apps/api/prisma/schema.prisma` — `User` + `SocialAccount` models
- `apps/api/src/config/env.validation.ts` — zod-validated env, fails fast on boot
- `apps/api/src/common/crypto/*` — AES-256-GCM `EncryptionService` for tokens at rest
- `apps/api/src/common/guards/jwt-auth.guard.ts`, `common/decorators/current-user.decorator.ts`
- `apps/api/src/auth/*` — register/login/logout/me (argon2 + JWT in an httpOnly cookie)
- `apps/api/src/social/providers/social-provider.interface.ts` — the seam for IG/FB later
- `apps/api/src/social/providers/provider.registry.ts` — Platform → provider lookup
- `apps/api/src/social/providers/youtube/*` — `YouTubeProvider` + `YouTubeOAuthController`
  (`GET /auth/youtube`, `GET /auth/youtube/callback`)
- `apps/api/src/social/oauth-state.service.ts` — signs/verifies the OAuth `state`,
  double-submit nonce cookie for CSRF protection
- `apps/api/src/social/social-accounts.{controller,service}.ts` —
  `GET /api/social-accounts`, `DELETE /api/social-accounts/:platform/:id`
- `apps/api/src/social/token-refresh.service.ts` — refreshes expired access tokens
  using the stored refresh token; ready for the future upload feature to call
- `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`
- `apps/web/components/connected-accounts.tsx` — the Connected Accounts card
- `apps/web/lib/api.ts`, `apps/web/lib/types.ts`
- `docker-compose.yml`, `pnpm-workspace.yaml`, root `package.json`, `.env.example` files

**Explicitly not built** (per scope): video uploading, AI generation, Redis/BullMQ,
Instagram, Facebook, scheduling. The `SocialProvider` interface and `ProviderRegistry`
exist so adding Instagram/Facebook later is "implement the interface + register it" —
no changes needed to the database, controllers, or the dashboard shell.

## 7. Adding a new platform later

1. Implement `SocialProvider` (see `apps/api/src/social/providers/youtube/youtube.provider.ts`)
   for the new platform.
2. Register it in `ProviderRegistry`.
3. Add a `<Platform>OAuthController` mirroring `YouTubeOAuthController` (or generalize
   it — both controllers are thin enough to merge behind a `:platform` param if you
   prefer one route family over one-controller-per-platform).
4. Add the platform's row to `ConnectedAccounts` in the frontend (currently rendered
   as a disabled "Coming soon" placeholder for Instagram/Facebook).

No `SocialAccount` schema changes needed — `platform`, `platformUserId`, `displayName`
were named generically for exactly this.

## 8. Milestone 2 — publish a video to YouTube

`/create` uploads a video file to the backend, which uploads it to the connected
channel via YouTube Data API's `videos.insert` (resumable upload protocol) and stores
the result in a new `publishing_jobs` table.

**Required one-time setup — do this before testing:**

1. **Add the upload scope in Google Cloud Console**: APIs & Services → OAuth consent
   screen → Edit → Scopes → Add scope → search and check
   `.../auth/youtube.upload` → Update → Save. (Milestone 1 only requested
   `.../auth/youtube.readonly`, which can't upload — this is additive, not a
   replacement.)
2. **Reconnect your channel**: Dashboard → Disconnect → Connect YouTube again. Existing
   connections only carry the readonly scope and will be rejected by `videos.insert`
   with `insufficientPermissions` until reconnected.

**Endpoints added:**

- `POST /api/youtube/publish` — multipart (`video` file + `title`/`description`/`privacyStatus`),
  returns `202 { job }` immediately with `status: "QUEUED"`.
- `GET /api/publishing-jobs/:id` — poll for status.
- `GET /api/publishing-jobs?limit=10` — recent jobs for the signed-in user.
- `POST /api/publishing-jobs/:id/cancel` — aborts an in-flight upload.

**Two YouTube-side realities worth knowing before you test:**

- **Quota**: `videos.insert` costs 1600 units against a default 10,000/day quota —
  about 6 uploads/day before you hit `quota_exceeded`.
- **Unverified app**: while your OAuth app is in Testing status, Google may keep
  uploaded videos private regardless of the `privacyStatus` you send. The success
  screen in `/create` notes this so it doesn't read as a bug.

## 9. Facebook + Instagram setup

Both integrations run on the same Meta app — `META_APP_ID` / `META_APP_SECRET` in
`apps/api/.env` — but are otherwise independent: separate redirect URIs, separate
scopes, and (for Instagram) a completely separate OAuth host, since Instagram no
longer requires a linked Facebook Page to connect.

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and open
   (or create) your app.
2. **Add products** (App Dashboard → Add Product):
   - **Facebook Login for Business** — powers `/auth/facebook`. Under its Settings, add
     `http://localhost:5000/auth/facebook/callback` to *Valid OAuth Redirect URIs*.
   - **Instagram** (the "Instagram API setup with Instagram Login" product) — powers
     `/auth/instagram`. Add `http://localhost:5000/auth/instagram/callback` under its
     own OAuth settings.
3. **Permissions**: `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`
   (Facebook) and `instagram_business_basic` / `instagram_business_content_publish`
   (Instagram) are all Advanced Access permissions — using them with real accounts
   requires App Review + Business Verification. While the app is in Development mode,
   only people with a role on the app can connect:
   - **Facebook**: any account with an Admin/Developer/Tester role, connecting a Page
     they personally administer.
   - **Instagram**: the account must (a) be a Professional — Business or Creator —
     account, not a personal one, and (b) be added under App Roles → Instagram Testers,
     with the invite accepted from inside Instagram's own Settings → Apps and Websites
     → Tester Invites.
4. Copy the app's **App ID** and **App secret** into `META_APP_ID` / `META_APP_SECRET`
   in `apps/api/.env`.

**Endpoints added:**

- `GET /auth/facebook`, `GET /auth/facebook/callback` — connect flow.
- `POST /api/facebook/publish` — multipart (`video` file + `caption`), publishes
  synchronously (the response only arrives once Facebook has accepted the video —
  there's no job-polling here, unlike YouTube's `/api/youtube/publish`).
- `GET /api/facebook/videos` — videos already on the connected Page.
- `GET /auth/instagram`, `GET /auth/instagram/callback` — connect flow.
- `POST /api/instagram/publish` — multipart (`video` file + `caption`, MP4/MOV only),
  publishes a Reel via Instagram's resumable-upload Content Publishing flow; this can
  take a minute or two since Instagram processes the video before the container can be
  published.
- `GET /api/instagram/media` — media already on the connected account.

Both `FacebookProvider` and `InstagramProvider` have no refresh-token mechanism wired
up (Meta's own renewal endpoints don't fit `TokenRefreshService`'s persist-a-refresh-
token contract — see the comments in each provider) — connections need reconnecting
roughly every 60 days.
