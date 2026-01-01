# 📜 Scripts dos Jogos

Esta pasta é para referência. Os scripts são armazenados no banco de dados e gerenciados pelo painel admin.

## Estrutura

Os scripts são organizados por jogo no banco de dados:

```
GameScript {
  id: string
  name: string          // Nome do script
  placeId: number       // ID do lugar no Roblox
  gameId: number        // ID do jogo (opcional)
  content: string       // Código Lua
  enabled: boolean      // Se está ativo
  version: string       // Versão do script
}
```

## Adicionando Scripts

1. Acesse o painel admin
2. Vá em "Scripts"
3. Clique em "Add Script"
4. Preencha:
   - **Name**: Nome descritivo do script
   - **Place ID**: ID do lugar (encontre na URL do jogo)
   - **Game ID**: ID do universo (opcional)
   - **Content**: Código Lua do script
   - **Enabled**: Se deve estar ativo

## Encontrando Place ID

1. Acesse o jogo no Roblox
2. A URL será algo como: `https://www.roblox.com/games/2753915549/Blox-Fruits`
3. O número `2753915549` é o Place ID

## Exemplo de Script

```lua
-- Blox Fruits Script
-- Place ID: 2753915549

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

-- Seu código aqui
print("Script carregado com sucesso!")

-- Exemplo: Criar GUI
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui")

local Frame = Instance.new("Frame")
Frame.Size = UDim2.new(0, 200, 0, 100)
Frame.Position = UDim2.new(0, 10, 0, 10)
Frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
Frame.Parent = ScreenGui

local Title = Instance.new("TextLabel")
Title.Size = UDim2.new(1, 0, 0, 30)
Title.Text = "Wisper Hub - Blox Fruits"
Title.TextColor3 = Color3.fromRGB(255, 255, 255)
Title.BackgroundTransparency = 1
Title.Parent = Frame
```

## Boas Práticas

1. **Teste antes de publicar**: Sempre teste o script localmente
2. **Trate erros**: Use pcall para evitar crashes
3. **Não hardcode**: Use variáveis para valores configuráveis
4. **Documente**: Adicione comentários explicativos
5. **Versione**: Atualize a versão ao fazer mudanças

## Segurança

- Scripts são armazenados no servidor
- Nunca expostos sem autenticação válida
- Tokens de download são temporários (60s)
- Cada token só pode ser usado uma vez
