# 🛠️ Guia de Instalação - Wisper Hub

## Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Discord Developer Portal
- (Opcional) PostgreSQL para produção

## 1. Configuração do Backend (API)

### 1.1 Instalar dependências

```bash
cd api
npm install
```

### 1.2 Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Servidor
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui
JWT_EXPIRES_IN=7d

# Discord OAuth
DISCORD_CLIENT_ID=seu_client_id
DISCORD_CLIENT_SECRET=seu_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Segurança
API_SECRET_KEY=chave_secreta_para_assinaturas
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 1.3 Configurar Discord OAuth

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação
3. Vá em OAuth2 > General
4. Adicione o Redirect URI: `http://localhost:3001/api/auth/discord/callback`
5. Copie o Client ID e Client Secret para o `.env`

### 1.4 Inicializar banco de dados

```bash
npx prisma generate
npx prisma db push
```

### 1.5 Iniciar servidor

```bash
npm run dev
```

## 2. Configuração do Frontend (Web)

### 2.1 Instalar dependências

```bash
cd web
npm install
```

### 2.2 Configurar variáveis de ambiente

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:3001
VITE_DISCORD_CLIENT_ID=seu_client_id
```

### 2.3 Iniciar servidor de desenvolvimento

```bash
npm run dev
```

## 3. Configuração do Loader (Roblox)

1. Hospede o arquivo `loader/loader.lua` em um servidor HTTPS
2. Configure a URL da API no loader
3. Use no Roblox:

```lua
loadstring(game:HttpGet("https://seu-servidor.com/loader.lua"))()
```

## 4. Primeiro Acesso

1. Acesse `http://localhost:5173`
2. Faça login com Discord
3. **O primeiro usuário registrado será automaticamente o ADMIN**
4. Configure os checkpoints no painel admin
5. Adicione scripts para os jogos

## 5. Produção

### Recomendações

- Use PostgreSQL em vez de SQLite
- Configure HTTPS com certificado SSL
- Use um reverse proxy (nginx)
- Configure variáveis de ambiente de produção
- Ative logs de auditoria

### Deploy

```bash
# Build do frontend
cd web
npm run build

# Build do backend
cd api
npm run build
npm start
```
