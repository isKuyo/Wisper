# 🌟 Wisper Hub

Um hub de scripts profissional para Roblox com sistema de autenticação por key, checkpoints configuráveis e integração com Discord.

## 📁 Estrutura do Projeto

```
Wisper Hub/
├── api/                    # Backend API (Node.js/Express)
│   ├── src/
│   │   ├── controllers/    # Controladores de rotas
│   │   ├── middleware/     # Middlewares (auth, rate limit, etc)
│   │   ├── models/         # Modelos do banco de dados
│   │   ├── routes/         # Definição de rotas
│   │   ├── services/       # Lógica de negócio
│   │   ├── utils/          # Utilitários
│   │   └── config/         # Configurações
│   ├── package.json
│   └── .env.example
│
├── web/                    # Frontend Website (React + Vite)
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── pages/          # Páginas
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API calls
│   │   └── styles/         # Estilos CSS
│   └── package.json
│
├── loader/                 # Script Loader Roblox (Lua)
│   ├── loader.lua          # Script principal do loader
│   └── README.md           # Documentação do loader
│
├── scripts/                # Scripts dos jogos (armazenados no servidor)
│   └── README.md           # Documentação dos scripts
│
└── docs/                   # Documentação completa
    ├── API.md              # Documentação da API
    ├── SECURITY.md         # Documentação de segurança
    └── SETUP.md            # Guia de instalação
```

## 🚀 Funcionalidades

### Sistema de Key
- Keys únicas vinculadas ao HWID do dispositivo
- Validação server-side
- Reset de HWID via website

### Checkpoints (Monetização)
- Suporte a múltiplas plataformas (Linkvertise, LootLabs, Work.ink)
- Quantidade configurável pelo admin
- Validação automática de conclusão

### Website
- Login via Discord OAuth
- Dashboard do usuário
- Painel administrativo
- Gerenciamento de scripts por jogo

### Segurança
- Rate limiting
- Assinaturas de requisição
- Tokens temporários
- Proteção contra API abuse
- Logs de auditoria

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, Prisma ORM, SQLite/PostgreSQL
- **Frontend**: React, Vite, TailwindCSS, shadcn/ui
- **Loader**: Roblox Lua
- **Autenticação**: Discord OAuth2, JWT

## 📦 Instalação

Consulte [docs/SETUP.md](docs/SETUP.md) para instruções detalhadas.

## 📄 Licença

Projeto privado - Todos os direitos reservados.
