# 📡 Documentação da API - Wisper Hub

## Base URL

```
Development: http://localhost:3001/api
Production: https://seu-dominio.com/api
```

## Autenticação

A API usa JWT (JSON Web Tokens) para autenticação. Inclua o token no header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 🔐 Autenticação

#### `GET /auth/discord`
Inicia o fluxo de login com Discord OAuth.

**Response**: Redirect para Discord

---

#### `GET /auth/discord/callback`
Callback do Discord OAuth.

**Query Parameters**:
- `code`: Código de autorização do Discord

**Response**:
```json
{
  "success": true,
  "token": "jwt_token_aqui",
  "user": {
    "id": "uuid",
    "discordId": "123456789",
    "username": "Usuario#1234",
    "isAdmin": false
  }
}
```

---

#### `GET /auth/me`
Retorna dados do usuário autenticado.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "id": "uuid",
  "discordId": "123456789",
  "username": "Usuario#1234",
  "avatar": "hash_avatar",
  "isAdmin": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 🔑 Keys

#### `POST /keys/generate`
Gera uma nova key para o usuário.

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "hwid": "hash_do_hwid"
}
```

**Response**:
```json
{
  "success": true,
  "key": "WISPER-XXXX-XXXX-XXXX-XXXX",
  "expiresAt": null,
  "checkpointsRequired": 3,
  "checkpointsCompleted": 0
}
```

---

#### `POST /keys/validate`
Valida uma key (usado pelo loader).

**Body**:
```json
{
  "key": "WISPER-XXXX-XXXX-XXXX-XXXX",
  "hwid": "hash_do_hwid",
  "placeId": 123456789,
  "signature": "assinatura_da_requisicao",
  "timestamp": 1704067200000
}
```

**Response (sucesso)**:
```json
{
  "valid": true,
  "status": "active",
  "scriptToken": "token_temporario_para_script"
}
```

**Response (checkpoints pendentes)**:
```json
{
  "valid": false,
  "status": "checkpoints_pending",
  "checkpointsRequired": 3,
  "checkpointsCompleted": 1,
  "checkpointUrl": "https://website.com/checkpoints"
}
```

---

#### `POST /keys/reset-hwid`
Reseta o HWID de uma key.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "message": "HWID resetado com sucesso"
}
```

---

### ✅ Checkpoints

#### `GET /checkpoints`
Lista checkpoints configurados.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "checkpoints": [
    {
      "id": 1,
      "order": 1,
      "platform": "linkvertise",
      "url": "https://linkvertise.com/...",
      "completed": false
    }
  ],
  "totalRequired": 3,
  "totalCompleted": 1
}
```

---

#### `POST /checkpoints/:id/complete`
Marca um checkpoint como completo.

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "token": "token_de_validacao_da_plataforma"
}
```

**Response**:
```json
{
  "success": true,
  "checkpointsCompleted": 2,
  "checkpointsRequired": 3,
  "allCompleted": false
}
```

---

### 📜 Scripts

#### `GET /scripts/:placeId`
Obtém o script para um jogo específico.

**Headers**: 
- `Authorization: Bearer <script_token>` (token temporário da validação)

**Response**:
```json
{
  "success": true,
  "script": "-- Código Lua do script aqui"
}
```

---

### 👑 Admin

#### `GET /admin/users`
Lista todos os usuários.

**Headers**: `Authorization: Bearer <admin_token>`

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "discordId": "123456789",
      "username": "Usuario#1234",
      "isAdmin": false,
      "key": "WISPER-XXXX-XXXX-XXXX-XXXX",
      "hwid": "***masked***",
      "checkpointsCompleted": 3,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `POST /admin/users/:id/reset-hwid`
Reseta HWID de qualquer usuário.

**Headers**: `Authorization: Bearer <admin_token>`

**Response**:
```json
{
  "success": true,
  "message": "HWID resetado com sucesso"
}
```

---

#### `GET /admin/scripts`
Lista todos os scripts.

**Headers**: `Authorization: Bearer <admin_token>`

**Response**:
```json
{
  "scripts": [
    {
      "id": "uuid",
      "name": "Script do Jogo X",
      "placeId": 123456789,
      "gameId": 987654321,
      "enabled": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `POST /admin/scripts`
Cria um novo script.

**Headers**: `Authorization: Bearer <admin_token>`

**Body**:
```json
{
  "name": "Script do Jogo X",
  "placeId": 123456789,
  "gameId": 987654321,
  "content": "-- Código Lua aqui",
  "enabled": true
}
```

---

#### `PUT /admin/scripts/:id`
Atualiza um script.

**Headers**: `Authorization: Bearer <admin_token>`

**Body**:
```json
{
  "name": "Script Atualizado",
  "content": "-- Novo código Lua",
  "enabled": true
}
```

---

#### `DELETE /admin/scripts/:id`
Remove um script.

**Headers**: `Authorization: Bearer <admin_token>`

---

#### `GET /admin/checkpoints`
Lista configuração de checkpoints.

**Headers**: `Authorization: Bearer <admin_token>`

---

#### `POST /admin/checkpoints`
Cria um novo checkpoint.

**Headers**: `Authorization: Bearer <admin_token>`

**Body**:
```json
{
  "order": 1,
  "platform": "linkvertise",
  "url": "https://linkvertise.com/...",
  "enabled": true
}
```

---

#### `PUT /admin/checkpoints/:id`
Atualiza um checkpoint.

---

#### `DELETE /admin/checkpoints/:id`
Remove um checkpoint.

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Bad Request - Parâmetros inválidos |
| 401 | Unauthorized - Token inválido ou expirado |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error |

## Rate Limiting

- **Padrão**: 100 requisições por minuto
- **Validação de key**: 30 requisições por minuto
- **Admin**: 200 requisições por minuto

Headers de resposta:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067260
```
