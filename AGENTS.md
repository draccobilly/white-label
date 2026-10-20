<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Leia isto no primeiro prompt

Esta pasta é um storefront de doações white label. É um produto separado. Não copie marca, campanhas, banco, Stripe, PayPal, Utmify ou `.env` de outro site.

Antes de alterar código, leia este arquivo até o fim. O operador trabalha sozinho a partir daqui.

## O que este sistema faz

Next.js (porta 3001 no PM2, nome `crowdfunding`) com:

- páginas públicas de campanha em `/c/[campaignSlug]/[affiliateSlug]`
- checkout Stripe embutido (e PayPal se as chaves existirem)
- admin em `/admin` (magic link + senha)
- portal do organizador
- cartas de doação, webhooks, Nginx e o script `deploy/apply-ngo-vps.sh`

O valor exibido na página da campanha **não** é `Campaign.currentAmount`. A fórmula fica em `lib/campaign-accounting.ts`:

- todos veem `baselineAmount + round(paidAmount * displayPaidPercent / 100)`
- este navegador também soma o último presente pago guardado no cookie
- `displayPaidPercent` é um inteiro 0–100, editado no admin ao lado de Raised / Doado
- se o valor faltar, o código usa `DISPLAYED_PAID_PERCENT = 1`

Não mude essa fórmula a menos que o dono peça.

## 1. Repositório GitHub

Neste computador o git já foi iniciado. Não há histórico antigo.

1. Crie um repositório **privado** novo na sua conta GitHub (vazio, sem README).
2. Nesta pasta:

```bash
git remote add origin git@github.com:SUA-CONTA/SEU-REPO.git
git branch -M main
git push -u origin main
```

3. Na VPS, crie uma chave só de leitura `/root/.ssh/ngo_deploy` e coloque a pública em Deploy keys do repositório.

Não use o remoto de outro produto. Não faça fork público.

## 2. VPS

Ubuntu, Node 22, Nginx, PM2, Certbot.

- pasta da app: `/var/www/crowdfunding`
- PM2: app `crowdfunding`, `127.0.0.1:3001`
- Nginx faz proxy HTTPS para essa porta
- o certificado renova sozinho depois do primeiro `certbot`

Primeira vez (como root), com o remoto já criado:

```bash
NGO_GIT_REMOTE=git@github.com:SUA-CONTA/SEU-REPO.git bash /caminho/local/deploy/bootstrap-ngo-vps.sh
```

Ou clone na mão:

```bash
git clone git@github.com:SUA-CONTA/SEU-REPO.git /var/www/crowdfunding
cp /var/www/crowdfunding/deploy/ngo.vps.env.example /var/www/crowdfunding/.env
chmod 600 /var/www/crowdfunding/.env
nano /var/www/crowdfunding/.env
```

## 3. Domínio e DNS

1. No registrador, crie um registro **A** do hostname público (exemplo `giving.suaorg.org`) para o **IP desta VPS**.
2. Coloque o mesmo hostname em `SITE_DOMAIN` no `.env`.
3. Espere o DNS propagar (`dig giving.suaorg.org`).
4. Primeiro deploy serve HTTP até existir certificado:

```bash
cd /var/www/crowdfunding
bash deploy/apply-ngo-vps.sh
certbot certonly --webroot -w /var/www/letsencrypt -d giving.suaorg.org
bash deploy/apply-ngo-vps.sh
```

Nginx responde `/robots.txt` e `/sitemap.xml` sozinho. Não mande esses caminhos para o Node. Os blocos estão em `deploy/nginx-ngo.conf` e `deploy/nginx-ngo-http.conf`.

## 4. Chaves (`nano .env`)

Crie **contas novas**. Nunca cole o `.env` de outro servidor.

| Chave | O que colocar |
| --- | --- |
| `SITE_DOMAIN` | hostname público, sem `https://` |
| `APP_NAME` | nome legal da organização |
| `ADMIN_EMAIL` | e-mail que recebe o magic link do admin |
| `ENCRYPTION_KEY` | 32+ caracteres aleatórios (`openssl rand -hex 32`) |
| `VAULT_ENCRYPTION_KEY` | 32 bytes em base64 (`openssl rand -base64 32`) |
| `DATABASE_URL` | pooler do **projeto Supabase novo** |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto novo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon do projeto novo |
| `SUPABASE_SERVICE_ROLE_KEY` | service role do projeto novo |
| `STRIPE_SECRET_KEY` | `sk_live_…` ou `sk_test_…` **desta** conta Stripe |
| `STRIPE_PUBLISHABLE_KEY` | `pk_…` no mesmo modo da secret |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint abaixo |
| `PAYPAL_CLIENT_ID` / `SECRET` / `WEBHOOK_ID` | só se for usar PayPal; vazio esconde o botão |
| `RESEND_API_KEY` / `RESEND_FROM` | e-mail de recibo |
| `UTMIFY_API_TOKEN` | **vazio** até esta organização ter a conta dela |
| `CRON_SECRET` | string aleatória |

No Supabase Authentication:

- Site URL: `https://SITE_DOMAIN`
- Redirect: `https://SITE_DOMAIN/auth/callback`

Webhook Stripe: `https://SITE_DOMAIN/api/webhooks/stripe`  
Depois das chaves no `.env`:

```bash
cd /var/www/crowdfunding
npx tsx scripts/create-stripe-webhook.ts
```

Webhook PayPal (se usar): `https://SITE_DOMAIN/api/webhooks/paypal`

Utmify: deixe `UTMIFY_API_TOKEN` vazio. O código de envio existe; o token entra no admin (afiliado) ou neste `.env` quando a conta nova existir. Não reutilize token de outro desk.

O deploy gera VAPID se faltar. Não copie VAPID de outro servidor.

## 5. Publicar

Cada vez que o `main` no GitHub mudar:

```bash
cd /var/www/crowdfunding
bash deploy/apply-ngo-vps.sh
```

O script faz `git reset --hard origin/main`, `prisma db push`, `npx tsx prisma/seed.ts` (empresa vazia com `APP_NAME`), build e reload do PM2. O `.env` permanece. Não publique cópias SFTP não commitadas.

Admin: `https://SITE_DOMAIN/admin`  
O seed não cria campanhas. Crie no admin. Suba logo, EIN e endereço em Admin → Settings.

## 6. Admin: o que pode sair depois

O painel veio completo. Itens que um desk institucional com um Stripe só costuma não usar — pode esconder ou apagar **depois**, se quiser um painel menor:

- Stripe Payment Links (o checkout institucional é o embutido)
- rótulos de PayPal enquanto `PAYPAL_CLIENT_ID` estiver vazio
- PagNovo e modos México / Argentina
- painel de várias empresas
- modo “campaign landing”, se o site for só institucional
- bloco de diretório de nonprofits
- rota morta `/admin/team`
- e-mail de afiliado que ainda não dispara aviso

**Não apague** sem pedido: percentagem de doado (`displayPaidPercent`), Raised / Doado, nomes no gateway, Utmify (fica vazio, pronto para a conta desta organização), organizadores e cartas fiscais.

## 7. Regras para o agente

- Não reponha marca, campanha, foto, EIN, domínio, IP ou chave de outro produto.
- Não rode scripts que copiem banco.
- Não commite `.env`.
- Leia o guia Next em `node_modules/next/dist/docs/` antes de APIs novas.
- Marca e textos públicos: Admin → Settings e `lib/i18n/en.ts` (e `es-MX.ts` se o site for espanhol).
- Carta fiscal: `lib/donation-letter-config.ts` e as imagens em `lib/donation-letter-assets.ts`.
