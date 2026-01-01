# 🔒 Documentação de Segurança - Wisper Hub

## Princípios de Segurança

### 1. Zero Trust no Client
- **Toda lógica crítica está no servidor**
- O loader Roblox é apenas uma interface
- Nenhuma validação de key, HWID ou checkpoints ocorre no client
- Scripts nunca são expostos sem autenticação válida

### 2. Defesa em Profundidade
- Múltiplas camadas de proteção
- Falha segura (fail-safe)
- Princípio do menor privilégio

---

## Proteções Implementadas

### 🔐 Autenticação

#### JWT (JSON Web Tokens)
- Tokens assinados com algoritmo HS256
- Expiração configurável (padrão: 7 dias)
- Refresh tokens para renovação
- Blacklist de tokens revogados

#### Discord OAuth2
- Login exclusivo via Discord
- Validação de state para prevenir CSRF
- Tokens do Discord nunca armazenados

### 🔑 Sistema de Keys

#### Geração de Keys
```
Formato: WISPER-XXXX-XXXX-XXXX-XXXX
- 20 caracteres alfanuméricos
- Gerados com crypto.randomBytes
- Únicos por usuário
```

#### Vinculação HWID
- HWID derivado de múltiplos identificadores do Roblox
- Hash SHA-256 antes do envio
- Nunca armazenado em texto puro no banco
- Hash adicional no servidor com salt único

#### Validação
```javascript
// Fluxo de validação
1. Receber key + HWID + placeId + signature + timestamp
2. Verificar assinatura da requisição
3. Verificar timestamp (máx 30 segundos)
4. Buscar key no banco
5. Comparar hash do HWID
6. Verificar checkpoints completos
7. Gerar token temporário para script
```

### 📝 Assinatura de Requisições

Todas as requisições do loader devem incluir assinatura:

```lua
-- No loader (Lua)
local timestamp = os.time() * 1000
local payload = key .. hwid .. placeId .. timestamp
local signature = sha256(payload .. API_SECRET)
```

```javascript
// No servidor (Node.js)
const expectedSignature = crypto
  .createHash('sha256')
  .update(payload + process.env.API_SECRET_KEY)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

### ⏱️ Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| Geral | 100 req | 1 min |
| Validação de key | 30 req | 1 min |
| Login | 10 req | 1 min |
| Admin | 200 req | 1 min |

Implementação com sliding window para precisão.

### 🛡️ Proteções Adicionais

#### Headers de Segurança
```javascript
helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
})
```

#### CORS
- Origens permitidas configuráveis
- Credentials habilitados apenas para origens confiáveis

#### Validação de Input
- Sanitização de todos os inputs
- Validação de tipos com Zod
- Escape de caracteres especiais

---

## Proteção contra Ataques

### 🔄 Replay Attacks
- Timestamp obrigatório em requisições
- Janela de validade de 30 segundos
- Nonce único por requisição (opcional)

### 🎭 Key Sharing
- HWID vinculado à key
- Apenas 1 HWID por key
- Reset de HWID limitado (configurável)
- Logs de tentativas de uso em HWIDs diferentes

### 🤖 Bots e Automação
- Rate limiting agressivo
- Captcha em operações sensíveis (opcional)
- Análise de padrões de uso

### 🔍 Reverse Engineering
- Scripts nunca expostos no client
- Tokens temporários para download de scripts
- Ofuscação opcional do loader

### 💉 Injection Attacks
- Prepared statements (Prisma ORM)
- Validação rigorosa de inputs
- Escape de caracteres em queries

---

## Logs de Auditoria

### Eventos Registrados
- Login/logout de usuários
- Geração de keys
- Validação de keys (sucesso/falha)
- Reset de HWID
- Alterações de checkpoints
- Alterações de scripts
- Tentativas de acesso não autorizado

### Formato do Log
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "event": "key_validation",
  "userId": "uuid",
  "ip": "xxx.xxx.xxx.xxx",
  "userAgent": "...",
  "success": true,
  "details": {
    "key": "WISPER-****-****-****-XXXX",
    "placeId": 123456789
  }
}
```

---

## Boas Práticas para Produção

### Variáveis de Ambiente
- Nunca commitar `.env`
- Usar secrets manager em produção
- Rotacionar secrets periodicamente

### HTTPS
- Certificado SSL obrigatório
- HSTS habilitado
- TLS 1.2+ apenas

### Banco de Dados
- Conexões criptografadas
- Backups regulares
- Acesso restrito por IP

### Monitoramento
- Alertas para tentativas de invasão
- Monitoramento de rate limit
- Análise de logs em tempo real

---

## Resposta a Incidentes

### Em caso de vazamento de key
1. Revogar key imediatamente
2. Forçar reset de HWID
3. Notificar usuário
4. Analisar logs

### Em caso de vazamento de API_SECRET
1. Rotacionar secret imediatamente
2. Invalidar todos os tokens
3. Forçar re-login de todos os usuários
4. Auditar acessos recentes

### Em caso de vazamento de scripts
1. Identificar origem do vazamento
2. Atualizar scripts afetados
3. Revisar controles de acesso
4. Implementar proteções adicionais
