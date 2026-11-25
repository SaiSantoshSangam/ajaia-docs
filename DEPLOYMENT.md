# Deploying Ajaia Docs to Vercel + Supabase

## 1. Supabase PostgreSQL Setup
1. Create a new project in [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor** and run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql).
   - Creates `public.users`, `public.documents` (`jsonb` content), and `public.document_shares` with UUIDs, timestamps, triggers, and Row Level Security policies.
3. Optional (recommended for reviewer testing): Run [`supabase/seed.sql`](supabase/seed.sql) in the SQL Editor to create the 3 demo accounts (`alice@ajaia.demo`, `bob@ajaia.demo`, `carol@ajaia.demo`, password `AjaiaDemo123!`) and sample documents.
4. In **Authentication -> URL Configuration**:
   - Set **Site URL** to your production Vercel domain (`https://your-app.vercel.app`).
   - Add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**.
5. Copy your **Project URL** and **anon public key** from **Project Settings -> API**.
   - Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Environment Variables (Vercel Project Settings)
Configure the following environment variables in Vercel (for Production, Preview, and Development):

| Variable | Required | Exposure | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Supabase anon public key (enforced by RLS) |
| `DEMO_USER_PASSWORD` | Optional | Server-only | Password for seeded demo accounts (defaults to `AjaiaDemo123!`) |
| `NEXT_PUBLIC_APP_URL` | Optional | Public | Canonical URL (auto-falls back to `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`) |

## 3. Deploy to Vercel
Option A — Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel --prod
```
Option B — Git Integration:
1. Push this repository to GitHub/GitLab/Bitbucket (confirm `.env.local` is not tracked).
2. Import the repository in [Vercel](https://vercel.com/new) with Next.js framework preset.
3. Add the environment variables above and click **Deploy**.

## 4. Production Verification Checklist
1. **Health & DB Connection**: Visit `GET https://your-app.vercel.app/api/health` and confirm HTTP `200` with:
   ```json
   { "status": "ok", "supabaseConfigured": true, "database": "connected" }
   ```
2. **Authentication / Demo Switcher**: Visit `/login`, sign in as `Alice Morgan` (`alice@ajaia.demo`).
3. **Create & Edit**: Click **New Document**, format text with Bold, Italic, Underline, H1, H2, Paragraph, Bullet/Numbered lists, wait for **Saved**, refresh the page, and confirm formatting persists.
4. **File Import**: From `/dashboard`, click **Import File**, upload a `.txt` or `.md` file (<= 2 MB), and confirm redirect to `/docs/[id]` with parsed content.
5. **Sharing & Authorization**:
   - Share a document with `bob@ajaia.demo` as **Viewer**.
   - Switch to **Bob Chen** via the Demo User switcher, open **Shared with Me**, confirm read-only UI, and verify direct `PATCH /api/documents/[id]` returns `403`.
   - Switch back to **Alice**, upgrade Bob to **Editor**, verify Bob can edit, then revoke Bob's access and verify Bob receives `403`.

