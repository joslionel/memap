# Memory Palace — Setup Guide

## 1. Create a Supabase project

1. Go to https://supabase.com and create a free account
2. Create a new project (choose a region near you)
3. Once it's ready, go to **Settings → API**
4. Copy the **Project URL** and **anon public key**

## 2. Run the database schema

1. In your Supabase project, open the **SQL Editor**
2. Open `supabase-schema.sql` from this directory
3. Paste the contents into the SQL editor and click **Run**

## 3. Enable Magic Link auth

1. In Supabase, go to **Authentication → Providers**
2. **Email** is enabled by default — magic links work out of the box
3. (Optional) In **Auth → URL Configuration**, set your site URL to `http://localhost:5173` for local dev

## 4. Add environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 5. Run the dev server

```bash
npm install   # if not done yet
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Using the app

### First time
1. Enter your email → click the magic link → you're in
2. Create a **Palace** (e.g. "Aberystwyth walk") with its loci
3. Create a **Memory Set** or **import a JSON file**
4. Create a **Journey** to link the palace and the set, then assign items to loci

### Importing existing JSON files
The existing `.json` files in the parent directory can be imported via **Sets → Import JSON**.
Supports both plain arrays and `{ meta, items }` format.

### Review vs Practice
- **Review**: shows locus + item together; navigate forward/back freely; rate confidence optionally
- **Practice**: shows locus only; you recall; reveal answer; rate confidence; SM-2 schedules repeats

---

## Deploying to GitHub Pages (when ready)

1. Add `base: '/your-repo-name/'` to `vite.config.js`
2. `npm run build`
3. Deploy the `dist/` folder via GitHub Pages

Or use Netlify/Vercel for easier one-click deploy with automatic HTTPS.
