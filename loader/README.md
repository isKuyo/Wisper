# 🎮 Wisper Hub Loader

Script loader para Roblox que autentica usuários e carrega scripts do hub.

## Uso

Execute no seu executor Roblox:

```lua
loadstring(game:HttpGet("https://seu-dominio.com/loader.lua"))()
```

## Configuração

Antes de hospedar o loader, edite as configurações no início do arquivo:

```lua
local CONFIG = {
    API_URL = "https://seu-dominio.com/api",  -- URL da sua API
    API_SECRET = "sua_chave_secreta",          -- Deve ser igual ao API_SECRET_KEY do servidor
    VERSION = "1.0.0",
    DEBUG = false
}
```

## Funcionalidades

### GUI
- Interface moderna e responsiva
- Arrastar para mover
- Input de key com validação de formato
- Botão para copiar URL do website
- Status em tempo real

### Segurança
- HWID gerado a partir de múltiplos identificadores
- Assinatura de requisições
- Timestamp para prevenir replay attacks
- Nenhuma lógica crítica no client

### Compatibilidade
Testado com os seguintes executores:
- Synapse X
- Script-Ware
- Krnl
- Fluxus
- Outros executores com suporte a HTTP requests

## Fluxo de Autenticação

1. Usuário executa o loader
2. Loader verifica status do hub (manutenção)
3. Usuário insere a key
4. Loader gera HWID e assinatura
5. Requisição enviada ao servidor
6. Servidor valida key, HWID e checkpoints
7. Se válido, servidor retorna token temporário
8. Loader usa token para baixar script
9. Script é executado

## Mensagens de Status

| Status | Descrição |
|--------|-----------|
| `invalid` | Key não existe |
| `disabled` | Key foi desativada |
| `expired` | Key expirou |
| `banned` | Conta banida |
| `hwid_mismatch` | Key vinculada a outro dispositivo |
| `checkpoints_pending` | Checkpoints não completados |
| `no_script` | Sem script para este jogo |

## Hospedagem

O loader deve ser hospedado em um servidor HTTPS. Opções:
- GitHub Raw (gratuito)
- Servidor próprio
- CDN

### Exemplo com GitHub

1. Crie um repositório
2. Faça upload do `loader.lua`
3. Use a URL raw:
```
https://raw.githubusercontent.com/seu-usuario/seu-repo/main/loader.lua
```

## Desenvolvimento

Para testar localmente:

1. Configure `DEBUG = true`
2. Use um servidor local com HTTPS (ngrok, etc)
3. Atualize `API_URL` para seu servidor local
