# Wisper Hub - Guia de Deploy

## Arquitetura de Produção

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │      API        │     │   Discord Bot   │
│   (Vercel)      │────▶│   (Railway)     │◀────│   (Railway)     │
│   React/Vite    │     │   Express/SQLite│     │   discord.js    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 1. Deploy da API no Railway

### 1.1 Criar conta e projeto
1. Acesse [railway.app](https://railway.app) e faça login com GitHub
2. Clique em **New Project** > **Deploy from GitHub repo**
3. Selecione o repositório do Wisper Hub
4. Configure o **Root Directory** como `api`

### 1.2 Configurar variáveis de ambiente
No Railway, vá em **Variables** e adicione:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `PORT` | `3001` | Porta do servidor |
| `NODE_ENV` | `production` | Ambiente |
| `DATABASE_URL` | `file:./data/wisper.db` | Caminho do banco |
| `JWT_SECRET` | `(gerar)` | Gere com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `30d` | Expiração do token |
| `REFRESH_TOKEN_EXPIRES_IN` | `30d` | Expiração do refresh |
| `DISCORD_CLIENT_ID` | `1444290393716822167` | Seu Client ID |
| `DISCORD_CLIENT_SECRET` | `(seu secret)` | Do Discord Developer Portal |
| `DISCORD_REDIRECT_URI` | `https://SEU-APP.railway.app/api/auth/discord/callback` | URL de callback |
| `DISCORD_SCOPES` | `identify guilds.members.read guilds.join` | Scopes OAuth |
| `FRONTEND_URL` | `https://SEU-SITE.vercel.app` | URL do frontend |
| `API_SECRET_KEY` | `(gerar)` | Gere uma string aleatória |
| `HWID_SALT` | `(gerar)` | Gere uma string aleatória |
| `SCRIPT_TOKEN_EXPIRES_IN` | `60` | Segundos |

### 1.3 Configurar volume para persistência
1. No Railway, clique em **+ New** > **Volume**
2. Mount path: `/app/data`
3. Isso garante que o banco SQLite persista entre deploys

### 1.4 Atualizar Discord OAuth
No [Discord Developer Portal](https://discord.com/developers/applications):
1. Vá em OAuth2 > Redirects
2. Adicione: `https://SEU-APP.railway.app/api/auth/discord/callback`

---

## 2. Deploy do Frontend na Vercel

### 2.1 Criar projeto
1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New** > **Project**
3. Importe o repositório do Wisper Hub
4. Configure:
   - **Root Directory**: `web`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Configurar variáveis de ambiente
No Vercel, vá em **Settings** > **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://SEU-APP.railway.app` |
| `VITE_DISCORD_CLIENT_ID` | `1444290393716822167` |

### 2.3 Deploy
Clique em **Deploy** e aguarde o build.

---

## 3. Deploy do Bot Discord no Railway

### 3.1 Criar novo serviço
1. No mesmo projeto Railway, clique em **+ New** > **GitHub Repo**
2. Configure o **Root Directory** como `bot`

### 3.2 Configurar variáveis de ambiente

| Variável | Valor |
|----------|-------|
| `DISCORD_BOT_TOKEN` | `(seu token do bot)` |
| `DISCORD_CLIENT_ID` | `1444290393716822167` |
| `DISCORD_OWNER_ID` | `1088946006663630969` |
| `DISCORD_GUILD_ID` | `(opcional)` |
| `API_URL` | `https://SEU-APP.railway.app` |
| `SITE_URL` | `https://SEU-SITE.vercel.app` |
| `DATABASE_URL` | `(mesmo do API, ou usar API endpoints)` |

---

## 4. Atualizar o Loader

Após deploy, atualize o loader com a URL de produção:

```lua
-- loader/loader.lua linha 8
local CONFIG = {
    API_URL = "https://SEU-APP.railway.app/api",
    VERSION = "1.0.0",
    DEBUG = false  -- Desativar debug em produção
}
```

---

## 5. Checklist Final

- [ ] API rodando no Railway
- [ ] Volume configurado para persistência do banco
- [ ] Frontend rodando na Vercel
- [ ] Variáveis de ambiente configuradas em ambos
- [ ] Discord OAuth redirect atualizado
- [ ] Bot Discord rodando no Railway
- [ ] Loader atualizado com URL de produção
- [ ] Primeiro usuário registrado se torna admin

---

## Troubleshooting

### Erro de CORS
Verifique se `FRONTEND_URL` na API está correto.

### Erro de OAuth
Verifique se `DISCORD_REDIRECT_URI` está exatamente igual no .env e no Discord Developer Portal.

### Banco não persiste
Certifique-se de que o volume está montado em `/app/data` e `DATABASE_URL` aponta para `file:./data/wisper.db`.

### Bot não conecta ao banco
O bot precisa acessar o mesmo banco da API. No Railway, ambos os serviços podem compartilhar o volume.

---

## Gerar Secrets Seguros

Execute no terminal para gerar strings seguras:

```bash
# JWT Secret (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# API Secret Key (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# HWID Salt (16 bytes)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```
