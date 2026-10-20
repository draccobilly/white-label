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

## Mapa do projeto

Esta pasta é o produto inteiro. Não há pasta irmã, remoto antigo, nem outra operação para copiar.

| Pasta | Função |
| --- | --- |
| `app/` | rotas Next.js: site público, `/admin`, `/portal`, `/c/...` campanha, `/api` |
| `components/campaign` | página pública da campanha (layouts Classic e Impact) |
| `components/checkout` | Stripe embutido, PayPal, carteira, gorjeta |
| `components/admin` | painel |
| `components/portal` | organizador |
| `components/public` | home institucional, header, footer, páginas de texto |
| `lib/` | dinheiro, webhooks, Utmify, auth, i18n, e-mail |
| `prisma/` | schema e `seed.ts` (empresa vazia com `APP_NAME`) |
| `deploy/` | Nginx, bootstrap da VPS, `apply-ngo-vps.sh` |
| `tests/unit` | vitest |

Fluxos que o agente precisa conhecer:

1. Doador abre `/c/[campaignSlug]/[affiliateSlug]`. O raised público vem de `lib/campaign-accounting.ts`.
2. Checkout chama `POST /api/stripe/embedded-session` (ou PayPal). O intent nasce em `lib/embedded-checkout.ts` (`startEmbeddedDonation`).
3. Stripe avisa `POST /api/webhooks/stripe`. O pagamento vira venda em `lib/record-paid-session.ts`. Gorjeta sai dos line items (`Mission tip`) ou do PaymentIntent.
4. Admin entra em `/admin` com magic link (`ADMIN_EMAIL`) ou senha. Organizador entra em `/portal`.
5. Publicar: push neste remoto, depois `bash deploy/apply-ngo-vps.sh` nesta VPS.

Textos e marca desta organização: Admin → Settings, `lib/i18n/en.ts`, `lib/donation-letter-config.ts`. Não restaure nomes, fotos, EIN, domínio ou chave de outro site.

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

## O que tem que funcionar igual

O site novo cobra, rastreia e mostra doações no mesmo fluxo institucional que este código já implementa. Contas, domínio, marca, EIN e campanhas são desta organização. Não copie banco nem `.env` de outro servidor.

Comportamento que tem que estar no ar:

- Home institucional. Empresa padrão com `siteMode = INSTITUTIONAL`, `paymentGateway = STRIPE`, `campaignLayout = IMPACT`, `locale = en`, sem prefixo `/mexico` ou `/argentina`. O `prisma/seed.ts` já grava isso a partir de `APP_NAME`.
- Página da campanha no layout Impact: história à esquerda, widget de doação fixo à direita, em `/c/[campaignSlug]/direct-team`.
- Checkout Stripe embutido na própria página. Cartão, Apple Pay e Google Pay. Payment Link não é o caminho desta operação.
- Gorjeta opcional de exatamente US$ 5 (`500` centavos). No Stripe o item se chama `Mission tip`. Sem gorjeta, o valor é só o presente.
- PayPal aparece só quando `PAYPAL_CLIENT_ID` existe.
- O nome que vai para Stripe e PayPal é o rótulo do gateway (`gatewayNames`), revisado no admin. Não é o título da campanha.
- Raised público: `baselineAmount + round(paidAmount * displayPaidPercent / 100)`, mais o último presente deste navegador. `displayPaidPercent` começa em `1`. No admin, Raised / Doado é `currentAmount`.
- Recibo liberado 24 horas depois do pagamento. O e-mail de obrigado sai na hora, pela Resend.
- Carta de reconhecimento em PDF para presentes de US$ 250 ou mais, anexada nesse e-mail.
- Utmify recebe a venda paga do afiliado da página. O worker é `GET /api/cron/outbox`.
- Admin em `/admin` (magic link no `ADMIN_EMAIL`, depois senha). Organizador em `/portal`.
- Fuso das vendas e da carta: `America/Los_Angeles`.
- PagNovo, México e Argentina ficam desligados nesta operação.

## 4. Contas novas

Abra uma conta nova de cada serviço. O modelo em `deploy/ngo.vps.env.example` já lista as chaves. Preencha no `/var/www/crowdfunding/.env` (`chmod 600`).

| Serviço | Para que serve |
| --- | --- |
| Supabase | banco Postgres e login do admin |
| Stripe | cartão, Apple Pay, Google Pay, reembolso e disputa |
| PayPal | botão extra; vazio esconde o botão |
| Resend | e-mail de obrigado e carta em PDF |
| Utmify | pixel e API da venda paga |
| OpenAI ou Anthropic | gera os nomes do gateway a partir da história; sem chave, o admin escreve os nomes na mão |

Depois de mudar o `.env`: `pm2 restart crowdfunding --update-env`.

### 4.1 `.env` obrigatório

| Chave | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `SITE_DOMAIN` | hostname público, sem `https://` |
| `NEXT_PUBLIC_APP_URL` | `https://SITE_DOMAIN` |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | o mesmo `https://SITE_DOMAIN` |
| `APP_NAME` | nome legal desta organização |
| `ADMIN_EMAIL` | caixa que recebe o magic link |
| `APP_ROLE` | `all` |
| `LOCAL_ADMIN_BYPASS` | `false` na VPS |
| `TZ` | `America/Los_Angeles` |
| `NEXT_ASSET_PREFIX` | `/__giving` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (32+ caracteres). Criptografa token Utmify e segredo de webhook no banco. Perder a chave inutiliza o que já foi salvo. |
| `VAULT_ENCRYPTION_KEY` | `openssl rand -base64 32` (exatos 32 bytes). Sem ela o cofre `/admin/vault` não guarda segredo. Guarde uma cópia no gerenciador de senhas. |
| `DATABASE_URL` | pooler Supabase, porta 5432, `?sslmode=require`. Formato: `postgresql://postgres.PROJECT_REF:SENHA@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do projeto novo |
| `SUPABASE_SERVICE_ROLE_KEY` | service role do projeto novo |
| `STRIPE_SECRET_KEY` | `sk_live_…` desta conta (ou `sk_test_…` só em teste) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_…` no **mesmo modo** da secret |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` gerado no passo 4.3 |
| `RESEND_API_KEY` | `re_…` |
| `RESEND_FROM` | `Nome <caixa@dominio-verificado>` |
| `REFUND_EMAIL` | caixa dos pedidos de reembolso |
| `EMAIL_LOGO_URL` | URL absoluta do logo, ou vazio (cai no ícone padrão) |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `UTMIFY_API_TOKEN` | token `x-api-token` desta conta Utmify. Vazio até a conta existir. O deploy avisa e segue. |
| `VAPID_SUBJECT` | `mailto:ADMIN_EMAIL` |

O deploy gera `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `INSIGHT_CRON_SECRET` se faltarem. Não copie VAPID de outro servidor.

Opcionais, deixe vazio se não for usar:

| Chave | Quando |
| --- | --- |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` | botão PayPal |
| `PAYPAL_API_BASE` | só se não for a API live padrão |
| `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` | nomes de produto no gateway |
| `GATEWAY_NAMES_PROVIDER` | `openai` ou `anthropic`, só se as duas chaves existirem |
| `GATEWAY_NAMES_MODEL` | só para trocar o modelo padrão |
| `DIRECT_URL` | host direto do Supabase se o pooler recusar `prisma db push` |
| `PAGNOVO_*` | deixe vazio. Esta operação não usa PagNovo. |
| `META_CAPI_ACCESS_TOKEN`, `META_PIXEL_ID` | deixe vazio. Compra não dispara pixel do Facebook nem CAPI. |

### 4.2 Supabase

Projeto novo, região à escolha. Authentication → URL Configuration:

- Site URL: `https://SITE_DOMAIN`
- Redirect URLs: `https://SITE_DOMAIN/auth/callback`
- Provedor Email ligado
- Refresh token: 8 a 12 semanas, para o admin no Safari (atalho na tela inicial) não cair toda hora

Não aponte este app para o projeto Supabase de outra operação.

### 4.3 Stripe

Conta nova. Checkout embutido usa a API, não Payment Links.

1. Developers → API keys: secret e publishable no mesmo modo.
2. Settings → Payment methods: cartão ligado. Apple Pay e Google Pay ligados.
3. Settings → Payment method domains: adicione `SITE_DOMAIN` e conclua a verificação. Sem isso o botão Apple Pay não aparece.
4. Webhook, depois que o site responde em HTTPS:

```bash
cd /var/www/crowdfunding
npx tsx scripts/create-stripe-webhook.ts
```

O script cria `https://SITE_DOMAIN/api/webhooks/stripe` e grava `STRIPE_WEBHOOK_SECRET` no `.env`. Eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

`payment_intent.succeeded` é o que registra Apple Pay e Google Pay. Sem ele a carteira cobra e a venda não entra.

Se o endpoint já existir e o script não receber o segredo, gere um novo signing secret no Dashboard e cole em `STRIPE_WEBHOOK_SECRET`. Depois: `pm2 restart crowdfunding --update-env`.

Uma venda de teste (`sk_test_` / `pk_test_`) não mistura com live. Para ir ao ar, as duas chaves têm que ser `live`.

### 4.4 PayPal

App nesta conta PayPal, modo live.

- Return / webhook: `https://SITE_DOMAIN/api/webhooks/paypal`
- Eventos: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`
- Cole Client ID, Secret e Webhook ID no `.env`

Vazio = sem botão. O cartão Stripe continua.

### 4.5 Resend

1. Verifique o domínio de envio (SPF e DKIM no DNS).
2. `RESEND_FROM` usa um endereço desse domínio.
3. O e-mail de obrigado sai no pagamento. O link do recibo só abre 24 horas depois.

### 4.6 Utmify

Conta nova. Não reutilize token de outro desk.

1. `UTMIFY_API_TOKEN` no `.env` cobre o Direct Team quando a página não tem credencial própria.
2. No admin, no afiliado ou na página, cole o pixel script e, se quiser outro dashboard, o token daquela página.
3. O outbox manda a venda paga. Sem o cron do passo 5, a fila para.

### 4.7 Nomes no gateway

Com `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` no `.env`:

```bash
pm2 restart crowdfunding --update-env
npm run gateway:names
```

Revise a lista no passo Checkout da campanha antes de publicar. Cada nome é um template com `{amount}`. O checkout sorteia um nome da lista da campanha. Sem chave de modelo, escreva a lista no admin.

## 5. Publicar e o cron

Cada vez que o `main` no GitHub mudar:

```bash
cd /var/www/crowdfunding
bash deploy/apply-ngo-vps.sh
```

O script faz `git reset --hard origin/main`, `prisma db push`, `npx tsx prisma/seed.ts`, build e reload do PM2. O `.env` permanece. O seed cria a empresa vazia e o afiliado `direct-team`. Não cria campanha. Não publique cópia SFTP que não esteja no git.

O mesmo script instala `/etc/cron.d/crowdfunding-watch` (vigia a porta 3001 e não reinicia o PM2 se o site ainda responde).

Falta um cron à parte, todo minuto, para a fila de Utmify, a carta cancelada em reembolso e os comentários diários:

```cron
* * * * * root curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" http://127.0.0.1:3001/api/cron/outbox >/dev/null
```

Troque `SEU_CRON_SECRET` pelo valor de `CRON_SECRET`. Confira com `curl -s -H "Authorization: Bearer …" http://127.0.0.1:3001/api/cron/outbox`.

## 6. Admin, marca e a primeira campanha

Entre em `https://SITE_DOMAIN/admin` pelo magic link. Se o sistema pedir senha nova, ela fica em `/login/senha`.

Admin → Settings, nesta organização:

- Site mode: **Institutional NGO site** (o seed já deixa)
- Nome, logo, favicon, e-mail, telefone, endereço
- Nome legal, EIN e texto do nonprofit
- Cores se quiser trocar o padrão (`#232323` e `#02a95c`)

Admin → Companies: layout **Impact** e o logo do Impact. O seed já escolhe Impact. Classic é outra página; não use se a meta é o checkout institucional.

Textos da home e do sobre: `lib/i18n/en.ts` (e `es-MX.ts` se o site for espanhol). Commit e publique de novo.

Carta fiscal, antes de mandar PDF:

- `lib/donation-letter-config.ts`: nome legal, EIN, endereço, e-mail, nome e cargo de quem assina. O corte automático é US$ 250 (`automaticFromCents: 25000`), moeda `USD`.
- `lib/donation-letter-assets.ts`: troque o PNG do logo e o da assinatura. Hoje são pixels transparentes.

Primeira campanha, no admin:

1. Título, história, capa, meta e valores em USD.
2. `baselineAmount`: raised inicial, em centavos, separado dos presentes reais.
3. `displayPaidPercent`: deixe `1` até alguém pedir outro número.
4. Lista de `gatewayNames` revisada.
5. Página do afiliado `direct-team` ativa. O link público é `/c/SLUG-DA-CAMPANHA/direct-team`.
6. Um pagamento de teste. A venda aparece em Admin → Sales. O outro navegador vê só a fração pública; o navegador que pagou vê o presente inteiro somado.

Organizador entra em `/portal` com a conta criada em Admin → Organizers ou pelo formulário `/start-a-fundraiser`.

## 7. Conferência antes de anunciar

- `https://SITE_DOMAIN` abre a home institucional.
- `https://SITE_DOMAIN/c/SLUG/direct-team` abre o layout Impact.
- Cartão de teste (ou live, com valor mínimo) cria venda `PAID` e manda o e-mail Resend.
- Apple Pay só depois do domínio verificado na Stripe.
- Webhook Stripe no Dashboard está enabled e o último evento não falhou.
- `UTMIFY_API_TOKEN` preenchido e o cron do outbox responde 200.
- Recibo da venda de teste ainda espera 24 horas; a página `/gerenating-receipt` mostra a contagem.
- `/robots.txt` e `/sitemap.xml` respondem pelo Nginx, sem passar pelo Node.

## 8. O que pode sair do admin depois

O painel veio completo. Um desk institucional com um Stripe só pode esconder depois, se quiser um painel menor:

- Stripe Payment Links
- rótulos de PayPal enquanto `PAYPAL_CLIENT_ID` estiver vazio
- PagNovo e modos México / Argentina
- painel de várias empresas
- modo “campaign landing”
- diretório de nonprofits
- rota `/admin/team`
- aviso de e-mail de afiliado que ainda não dispara

Não apague sem pedido: `displayPaidPercent`, Raised / Doado, nomes no gateway, Utmify, organizadores e cartas fiscais.

## 9. Regras para o agente

- Não reponha marca, campanha, foto, EIN, domínio, IP ou chave de outro produto.
- Não rode scripts que copiem banco.
- Não commite `.env`.
- Leia o guia Next em `node_modules/next/dist/docs/` antes de APIs novas.
- Marca e textos públicos: Admin → Settings e `lib/i18n/en.ts`.
- Carta fiscal: `lib/donation-letter-config.ts` e `lib/donation-letter-assets.ts`.
