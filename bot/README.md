# Wisper Hub Discord Bot

Discord bot for managing keys and distributing scripts for Wisper Hub.

## Features

- 🔑 **Redeem Key** - Link admin-created keys to Discord accounts
- 📜 **Get Script** - Copy the loader script
- 🔄 **Reset HWID** - Reset hardware ID for linked keys
- 📊 **Stats** - View key statistics

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Token** (keep it secret!)
5. Go to "OAuth2" > "General" and copy the **Client ID**
6. Enable these Privileged Gateway Intents:
   - None required for this bot

### 2. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_OWNER_ID=your_discord_user_id_here
   DISCORD_GUILD_ID=your_guild_id_here  # Optional, for development
   DATABASE_URL="file:../api/prisma/dev.db"
   LOADER_SCRIPT=loadstring(game:HttpGet("https://your-url.com/loader.lua"))()
   ```

### 3. Install Dependencies

```bash
cd bot
npm install
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Deploy Slash Commands

```bash
npm run deploy
```

### 6. Start the Bot

```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Inviting the Bot

1. Go to OAuth2 > URL Generator in Discord Developer Portal
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
4. Copy and open the generated URL to invite the bot

## Commands

### `/script`
Displays the main Wisper Hub panel with action buttons:

- **Redeem Key** (Green) - Opens a modal to enter and link a key
- **Get Script** (Blue) - Shows the loader script to copy
- **Reset HWID** (Red) - Resets HWID for linked key
- **Stats** (Gray) - Shows key statistics

## Admin Key Creation

Admins can create keys via the web panel that users can redeem through the Discord bot:

1. Admin creates a key with desired duration via web panel
2. Admin gives the key to user
3. User uses `/script` > **Redeem Key** to link it to their Discord
4. User can then manage their key via Discord

## File Structure

```
bot/
├── index.js           # Main bot entry point
├── config.js          # Configuration
├── deploy-commands.js # Slash command deployment
├── package.json       # Dependencies
├── .env.example       # Environment template
├── commands/
│   └── script.js      # /script command
├── handlers/
│   ├── buttons.js     # Button interaction handlers
│   └── modals.js      # Modal submission handlers
└── prisma/
    └── schema.prisma  # Database schema (mirrors API)
```

## Troubleshooting

### Commands not showing up
- Run `npm run deploy` to register commands
- For guild commands: instant update
- For global commands: wait up to 1 hour

### Database errors
- Make sure the API's database exists
- Run `npx prisma generate` in the bot folder
- Check DATABASE_URL path is correct

### Bot offline
- Check token is correct in `.env`
- Check bot has been invited to server
- Check console for error messages
