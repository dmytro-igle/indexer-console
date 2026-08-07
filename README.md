# Igle Indexer

Internal tool to manage URL submissions across multiple domains, to two
separate engines:

- **IndexNow** (`api.indexnow.org`, free) — notifies Bing, Yandex, and a few
  other engines. Not Google.
- **Google**, via a third-party service, [RocketIndexer](https://rocketindexer.com)
  (`rocketindexer.com`, paid credits per URL) — "Submit to Google" and
  "Check Google Index Status" buttons.

Also: bulk-fetch sitemaps, self-check IndexNow key files, a lightweight SEO
audit, per-domain/per-run reports, and a CSV export (`#, Country, Domain,
Page URL, Submission status, HTTP code, Google Submission status, Google
HTTP/API code, Indexed status`) — one row per URL, showing each URL's most
recent status per engine (not one row per historical submission event).

## What this does — and doesn't — verify

- **Key verification** (IndexNow) is a self-check this app performs (GET the
  key file, compare to the key). IndexNow has no official "verify" API.
- **IndexNow submission status** reflects `api.indexnow.org`'s HTTP response
  (200/202 = accepted). IndexNow only notifies Bing, Yandex, and a few other
  engines — **not Google** — and accepting a submission is not the same as a
  page being indexed.
- **Google submission status** reflects RocketIndexer's `/submit` response.
  RocketIndexer also exposes a real `indexed_status` via its `/status`
  endpoint ("Check Google Index Status") — this is the one place in the app
  where "Indexed status" gets an actual verified signal instead of a manual
  placeholder, since RocketIndexer is a paid service actually tracking it.
  Note: `rocketindexer.com`'s unauthenticated/no-token requests (e.g. the
  documented no-auth health check, or a request with a fake token) get a
  Cloudflare interactive JS challenge instead of JSON — but a real,
  authenticated request does not: confirmed live against the `balance`
  endpoint with a real API key, which returned a normal 200 JSON response.
  So this shouldn't affect real usage; the client code still handles a
  challenge page gracefully either way (reports a clear "non-JSON response"
  error rather than crashing, in case it's ever encountered).
- **Country** is auto-detected from each homepage's `<html lang>` attribute.
  Because that attribute can be wrong (seen in production: `lang="en-US"` on
  fully Portuguese, Brazil-targeted pages), a content heuristic cross-checks
  for R$/Pix/Brasil/PT-BR vocabulary and flags likely mismatches under
  **Issues** rather than silently trusting the tag.
- **Indexed status** is otherwise a manual, editable field per URL — this
  app does not scrape Google/Bing search results (that gets CAPTCHA-blocked
  almost immediately and isn't a reliable signal).

## Local development

```bash
cp .env.example .env.local
# edit .env.local: set APP_PASSWORD and SESSION_SECRET (openssl rand -hex 32)
# optionally set ROCKETINDEXER_API_KEY to enable Google submission
npm install
npm run dev
```

Visit `http://localhost:3000`, log in with `APP_PASSWORD`, then add a domain
(host + IndexNow key; key location defaults to `https://<host>/<key>.txt`).

The SQLite database lives at `./data/indexnow.db` (gitignored).

## Deploying (Fly.io)

This needs a persistent writable volume for the SQLite file and a
long-running Node process (not a stateless serverless platform) — bulk
actions loop over every domain with per-request timeouts that can add up to
longer than a typical serverless function limit.

You'll need your own Fly.io account and the `flyctl` CLI installed and
logged in (`fly auth login`) — these steps can't be run on your behalf.

```bash
# 1. Create the app (skip the Postgres prompt — this app doesn't use it)
fly launch --no-deploy

# 2. Create the persistent volume for the SQLite file
fly volumes create indexnow_data --size 1 --region gru

# 3. Set secrets (never commit these — fly.toml only holds non-secret config)
fly secrets set \
  APP_PASSWORD='choose-a-strong-password' \
  SESSION_SECRET="$(openssl rand -hex 32)"

# 4. Deploy
fly deploy
```

`fly.toml` already points `DATABASE_PATH` at `/data/indexnow.db` (the mount)
and pins the app to a single machine — `better-sqlite3` is single-process
and file-locked, so running multiple machines against the same volume risks
corruption.

## Notes

- No-sitemap domains (verified key, but `sitemap.xml` 404s) are **skipped**
  during Submit All and flagged under Issues, rather than silently falling
  back to submitting just the homepage like the old manual workflow did.
  There's no manual "add a single URL" affordance yet — a natural follow-up
  if you want such domains included.
- `submit_all.sh`/the standalone `*.json` payload files from the original
  manual workflow live one directory up (`../`) and are unrelated to this
  app.
# indexer-console
