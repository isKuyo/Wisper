# Wisper Hub Protection System V4

## Filosofia

**Honestidade sobre o que é possível:**

- Lua é interpretada → `loadstring` SERÁ usado em algum momento
- Keys no client são sempre extraíveis → proteção = atraso, não segredo
- HWID precisa ser estável → não usar dados que mudam entre sessões
- Anti-tamper não pode ser agressivo → não matar usuários legítimos

**Foco:**
- ✅ DESMOTIVAR crackers casuais
- ✅ RASTREAR leakers via watermark
- ✅ FUNCIONAR de forma estável
- ❌ NÃO ser "impossível de quebrar" (isso não existe)

---

## Arquitetura de Proteção

```
┌─────────────────────────────────────────────────────────────────┐
│                    WISPER HUB ENTERPRISE V3                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   LOADER     │───▶│   SESSION    │───▶│  CHALLENGE   │       │
│  │  Protected   │    │   Create     │    │    PoW       │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   FRAGMENT   │◀───│   VERIFY     │◀───│   SOLVE      │       │
│  │   Receive    │    │   Solution   │    │   PoW        │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CLOSURE VM EXECUTION                        │    │
│  │  • Zero loadstring exposure                              │    │
│  │  • Natives via numeric indices                           │    │
│  │  • Isolated environment                                  │    │
│  │  • Continuous integrity monitoring                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Camadas de Proteção

### 1. Criptografia Multi-Camada (5 Layers)

| Layer | Operação | Descrição |
|-------|----------|-----------|
| 1 | XOR | Rotating key de 32 bytes |
| 2 | ADD | Adição com overflow (16 bytes) |
| 3 | ROT | Rotação de bits baseada em posição |
| 4 | S-BOX | Substituição com tabela de 256 bytes |
| 5 | POS-XOR | XOR com valor derivado da posição |

### 2. Loader Protection

- **Zero loadstring exposto** - Natives armazenados em array numérico
- **Build único por request** - Variáveis randomizadas a cada build
- **Session ID** - Expira em 10 minutos
- **Integrity hash** - Hash de todas as funções nativas
- **HWID hardening** - Múltiplas fontes (IP, UserId, PlaceId, JobId, Executor)

### 3. Server-Assisted Execution

- **Challenge/Response** - Proof-of-Work para cada fragmento
- **Fragmentação** - Script dividido em 8-12 partes
- **One-time tokens** - Cada fragmento só pode ser solicitado uma vez
- **Session timeout** - 60 segundos para completar

### 4. Anti-Instrumentation

| Check | Descrição |
|-------|-----------|
| Native hash | Verifica se funções nativas foram modificadas |
| Dump detection | Detecta `dumpstring`, `decompile`, `getscriptbytecode` |
| Timing attack | Detecta debugger por tempo de execução |
| Yield check | Verifica integridade de coroutines |
| pcall wrap | pcall é wrapped para evitar hooks |

### 5. Watermarking

- **Per-user ID** - ID único embutido em cada script
- **Timestamp** - Data/hora de geração
- **Signature** - HMAC para verificação
- **Tracking** - Permite identificar leakers

---

## Endpoints de API

### Proteção

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/protection/session` | POST | Cria sessão de execução |
| `/api/protection/verify` | POST | Verifica solução do challenge |
| `/api/protection/fragment` | POST | Solicita fragmento |
| `/api/protection/fragment/deliver` | POST | Entrega fragmento após PoW |
| `/api/protection/status/:id` | GET | Status da sessão |

### Loader

| Rota | Método | Descrição |
|------|--------|-----------|
| `/loader` | GET | Loader protegido (build único) |
| `/api/loader/validate` | POST | Valida key e retorna script token |
| `/api/scripts/:placeId` | GET | Script protegido (requer token) |

---

## Limitações Conhecidas

### ⚠️ Runtime Observável

Mesmo com toda proteção, o código precisa executar em algum momento:
- VM existe e pode ser instrumentada
- Decrypt existe e pode ser observado
- Um reverser experiente pode reconstruir lógica (dias/semanas de trabalho)

**Mitigação**: Proteção em camadas torna o processo extremamente tedioso.

### ⚠️ HWID Spoof

Nenhum sistema client-side resolve HWID spoof 100%:
- Executors podem falsificar qualquer dado local
- IP pode ser alterado via VPN

**Mitigação**:
- Múltiplas fontes de HWID (IP + UserId + PlaceId + JobId + Executor)
- Rate limiting por sessão
- Sessões curtas (60s)
- Logs de auditoria para detectar padrões

### ⚠️ Loadstring no Payload

O payload final ainda usa loadstring internamente:
- Capturado em closure isolada
- Acessado via índice numérico
- Não exposto globalmente

**Mitigação**: Loadstring é wrapped e verificado continuamente.

---

## Comparação com Concorrentes

| Feature | Wisper Hub | Luarmor | KRNL Private |
|---------|------------|---------|--------------|
| Multi-layer encryption | ✅ 5 layers | ✅ | ✅ |
| Server-assisted | ✅ | ✅ | ❌ |
| Challenge/Response | ✅ PoW | ❌ | ❌ |
| Per-user watermark | ✅ | ✅ | ✅ |
| Zero loadstring exposed | ✅ | ❌ | ❌ |
| Numeric indices | ✅ | ❌ | ❌ |
| HWID hardening | ✅ Multi-source | ✅ | ✅ |
| Session-based keys | ✅ | ❌ | ❌ |
| Build mutation | ✅ | ❌ | ❌ |

---

## Uso Comercial

### ✅ Adequado Para

- Hubs privados com 20K+ membros
- Proteção contra leak casual
- Desmotivar cracking
- Identificar leakers via watermark
- Monetização via checkpoints

### ⚠️ Considere

- Nenhuma proteção é 100% inquebrável
- Reversers dedicados podem eventualmente quebrar
- Foco em **desmotivar** e **rastrear**, não em ser "impossível"

---

## Arquivos do Sistema

```
api/src/utils/
├── protection-engine.js    # Engine principal V3
├── obfuscator-v2.js        # Versão anterior (backup)
└── obfuscator.js           # Versão legada

api/src/routes/
├── protection.js           # Rotas de proteção
├── loader.js               # Rotas do loader
└── scripts.js              # Rotas de scripts
```

---

## Configuração

### Variáveis de Ambiente

```env
JWT_SECRET=your-secret-key
API_SECRET_KEY=your-api-secret
SCRIPT_TOKEN_EXPIRES_IN=60
```

### Constantes (protection-engine.js)

```javascript
const CONFIG = {
  FRAGMENT_COUNT: 12,           // Número de fragmentos
  KEY_ROTATION_INTERVAL: 300000, // 5 minutos
  CHALLENGE_TIMEOUT: 30000,      // 30 segundos
  MAX_EXECUTION_TIME: 60000,     // 1 minuto
  WATERMARK_BITS: 64
};
```

---

## Changelog

### V3 (Atual)
- Zero loadstring exposto no loader
- Natives via índices numéricos
- HWID hardening com múltiplas fontes
- Build mutation por request
- Variáveis randomizadas

### V2
- Server-assisted execution
- Challenge/Response
- Fragmentação
- Anti-instrumentation

### V1
- Criptografia básica XOR
- VM simples
- Anti-tamper passivo
