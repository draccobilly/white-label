# Giving storefront

White-label donation site: public campaigns, Stripe checkout, admin, and organizer portal.

Open this folder in Cursor or Claude and read **AGENTS.md** first. That file is the go-live guide (GitHub, DNS, `.env`, VPS).

```bash
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Do not paste another organization's `.env`. Create a new Supabase project and a new Stripe account before the first deploy.
