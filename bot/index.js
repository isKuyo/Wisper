// ═══════════════════════════════════════════════════════════════
// WISPER HUB DISCORD BOT
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActivityType,
} = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const config = require('./config');

// Initialize Prisma with the API's database
const path = require('path');
const dbPath = path.resolve(__dirname, '../api/prisma/dev.db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`
    }
  }
});

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Load commands
client.commands = new Collection();

const scriptCommand = require('./commands/script');
client.commands.set(scriptCommand.data.name, scriptCommand);

// Load button handlers
const buttonHandlers = require('./handlers/buttons');

// Load modal handlers
const modalHandlers = require('./handlers/modals');

// ═══════════════════════════════════════════════════════════════
// READY EVENT
// ═══════════════════════════════════════════════════════════════
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Wisper Hub Bot is online as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} servers`);

  // Set activity
  const activityTypes = {
    PLAYING: ActivityType.Playing,
    STREAMING: ActivityType.Streaming,
    LISTENING: ActivityType.Listening,
    WATCHING: ActivityType.Watching,
    COMPETING: ActivityType.Competing,
  };

  readyClient.user.setActivity(config.activity.name, {
    type: activityTypes[config.activity.type] || ActivityType.Watching,
  });
});

// ═══════════════════════════════════════════════════════════════
// INTERACTION HANDLER
// ═══════════════════════════════════════════════════════════════
client.on(Events.InteractionCreate, async (interaction) => {
  // Attach prisma to interaction for easy access
  interaction.prisma = prisma;
  interaction.config = config;

  try {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`Command not found: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
    }

    // Handle Button Interactions
    else if (interaction.isButton()) {
      await buttonHandlers.handle(interaction);
    }

    // Handle Modal Submissions
    else if (interaction.isModalSubmit()) {
      await modalHandlers.handle(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);

    const errorMessage = {
      content: '❌ An error occurred while processing your request.',
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
client.login(config.token).catch((error) => {
  console.error('Failed to login:', error.message);
  process.exit(1);
});
