// ═══════════════════════════════════════════════════════════════
// DEPLOY SLASH COMMANDS
// Run this file to register/update slash commands with Discord
// Usage: node deploy-commands.js
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const config = require('./config');

// Import commands
const scriptCommand = require('./commands/script');

const commands = [
  scriptCommand.data.toJSON(),
];

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    let data;

    if (config.guildId) {
      // Guild-specific commands (instant update, good for development)
      console.log(`📍 Deploying to guild: ${config.guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
    } else {
      // Global commands (can take up to 1 hour to propagate)
      console.log('🌐 Deploying globally...');
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
    }

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
