// ═══════════════════════════════════════════════════════════════
// BUTTON HANDLERS
// Handles all button interactions
// ═══════════════════════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ═══════════════════════════════════════════════════════════════
// HELPER: Get key by Discord ID
// Checks both Key.discordId (standalone keys) and User.discordId (web login)
// ═══════════════════════════════════════════════════════════════
async function getKeyByDiscordId(prisma, discordId) {
  // First try to find a standalone key linked directly to Discord
  let key = await prisma.key.findUnique({
    where: { discordId: discordId },
  });

  if (key) return key;

  // If not found, try to find through User (web login with Discord OAuth)
  const user = await prisma.user.findUnique({
    where: { discordId: discordId },
    include: { key: true },
  });

  return user?.key || null;
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Format date
// ═══════════════════════════════════════════════════════════════
function formatDate(date) {
  if (!date) return 'N/A';
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}

function formatDateFull(date) {
  if (!date) return 'N/A';
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:F>`;
}

// ═══════════════════════════════════════════════════════════════
// REDEEM KEY BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleRedeemKey(interaction) {
  const prisma = interaction.prisma;
  const discordId = interaction.user.id;

  // Check if user already has a key linked
  const existingKey = await getKeyByDiscordId(prisma, discordId);

  if (existingKey) {
    // User already has a key - show option to relink
    const embed = new EmbedBuilder()
      .setTitle('🔑 Key Already Linked')
      .setDescription(
        `You already have a key linked to your account.\n\n` +
        `**Current Key:** ||${existingKey.key}||\n\n` +
        `Would you like to link a different key? This will unlink your current key.`
      )
      .setColor(interaction.config.colors.warning)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('relink_key')
        .setLabel('Link Different Key')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('cancel_relink')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }

  // Show modal to enter key
  const modal = new ModalBuilder()
    .setCustomId('redeem_key_modal')
    .setTitle('Redeem Key');

  const keyInput = new TextInputBuilder()
    .setCustomId('key_input')
    .setLabel('Enter your key')
    .setPlaceholder('WISPER-XXXX-XXXX-XXXX-XXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(24)
    .setMaxLength(24)
    .setRequired(true);

  const actionRow = new ActionRowBuilder().addComponents(keyInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════════
// RELINK KEY BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleRelinkKey(interaction) {
  // Show modal to enter new key
  const modal = new ModalBuilder()
    .setCustomId('relink_key_modal')
    .setTitle('Link Different Key');

  const keyInput = new TextInputBuilder()
    .setCustomId('key_input')
    .setLabel('Enter your new key')
    .setPlaceholder('WISPER-XXXX-XXXX-XXXX-XXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(24)
    .setMaxLength(24)
    .setRequired(true);

  const actionRow = new ActionRowBuilder().addComponents(keyInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════════
// CANCEL RELINK BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleCancelRelink(interaction) {
  await interaction.update({
    content: '✅ Operation cancelled.',
    embeds: [],
    components: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// GET SCRIPT BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleGetScript(interaction) {
  const config = interaction.config;

  const embed = new EmbedBuilder()
    .setTitle('📜 Loader Script')
    .setDescription(
      `\`\`\`lua\n${config.loaderScript}\n\`\`\``
    )
    .setColor(config.colors.primary)
    .setFooter({ text: 'Wisper Hub' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// RESET HWID BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleResetHwid(interaction) {
  const prisma = interaction.prisma;
  const config = interaction.config;
  const discordId = interaction.user.id;

  // Get user's key
  const key = await getKeyByDiscordId(prisma, discordId);

  if (!key) {
    const embed = new EmbedBuilder()
      .setTitle('❌ No Key Linked')
      .setDescription(
        `You don't have a key linked to your Discord account.\n\n` +
        `Use the **Redeem Key** button to link a key first.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if HWID is even bound
  if (!key.hwidHash) {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ No HWID Bound')
      .setDescription(
        `Your key doesn't have an HWID bound yet.\n\n` +
        `The HWID will be bound automatically when you first use the script.`
      )
      .setColor(config.colors.info)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check reset limits (2 per 12 hours)
  const now = new Date();
  let canReset = true;
  let resetsRemaining = 2;
  let waitTime = null;

  if (key.hwidResetWindowStart) {
    const windowEnd = new Date(key.hwidResetWindowStart);
    windowEnd.setHours(windowEnd.getHours() + 12);

    if (now < windowEnd) {
      // Still in window
      resetsRemaining = Math.max(0, 2 - (key.hwidResetCount || 0));

      if (resetsRemaining === 0) {
        canReset = false;
        waitTime = windowEnd;
      }
    } else {
      // Window expired, reset available
      resetsRemaining = 2;
    }
  }

  if (!canReset) {
    const embed = new EmbedBuilder()
      .setTitle('⏳ Reset Limit Reached')
      .setDescription(
        `You've used all your HWID resets for this period.\n\n` +
        `**Resets Available:** 0/2\n` +
        `**Resets Available:** ${formatDate(waitTime)}`
      )
      .setColor(config.colors.warning)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Confirm reset
  const embed = new EmbedBuilder()
    .setTitle('🔄 Confirm HWID Reset')
    .setDescription(
      `Are you sure you want to reset your HWID?\n\n` +
      `**Resets Remaining:** ${resetsRemaining}/2\n\n` +
      `⚠️ After resetting, you'll need to use the script again to bind a new HWID.`
    )
    .setColor(config.colors.warning)
    .setFooter({ text: 'Wisper Hub' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_reset_hwid')
      .setLabel('Confirm Reset')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('cancel_reset_hwid')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM RESET HWID BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleConfirmResetHwid(interaction) {
  const prisma = interaction.prisma;
  const config = interaction.config;
  const discordId = interaction.user.id;

  const key = await getKeyByDiscordId(prisma, discordId);

  if (!key) {
    return interaction.update({
      content: '❌ Key not found.',
      embeds: [],
      components: [],
    });
  }

  const now = new Date();

  // Calculate new reset count and window
  let resetCount = key.hwidResetCount || 0;
  let windowStart = key.hwidResetWindowStart;

  if (windowStart) {
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 12);

    if (now >= windowEnd) {
      // Window expired, start new window
      resetCount = 0;
      windowStart = now;
    }
  } else {
    // First reset ever
    windowStart = now;
    resetCount = 0;
  }

  // Perform the reset
  await prisma.key.update({
    where: { id: key.id },
    data: {
      hwidHash: null,
      hwidResetCount: resetCount + 1,
      hwidResetWindowStart: windowStart,
      lastHwidReset: now,
      totalHwidResets: { increment: 1 },
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ HWID Reset Successful')
    .setDescription(
      `Your HWID has been reset!\n\n` +
      `**Resets Used:** ${resetCount + 1}/2\n\n` +
      `You can now use the script on a new device.`
    )
    .setColor(config.colors.success)
    .setFooter({ text: 'Wisper Hub' })
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// CANCEL RESET HWID BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleCancelResetHwid(interaction) {
  await interaction.update({
    content: '✅ HWID reset cancelled.',
    embeds: [],
    components: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// VIEW STATS BUTTON
// ═══════════════════════════════════════════════════════════════
async function handleViewStats(interaction) {
  const prisma = interaction.prisma;
  const config = interaction.config;
  const discordId = interaction.user.id;

  // Get user's key
  const key = await getKeyByDiscordId(prisma, discordId);

  if (!key) {
    const embed = new EmbedBuilder()
      .setTitle('❌ No Key Linked')
      .setDescription(
        `You don't have a key linked to your Discord account.\n\n` +
        `Use the **Redeem Key** button to link a key first.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Calculate status
  const now = new Date();
  let status = '✅ Active';
  let isExpired = false;

  if (!key.isActive) {
    status = '🚫 Disabled';
  } else if (key.expiresAt && new Date(key.expiresAt) < now) {
    status = '⏰ Expired';
    isExpired = true;
  }

  // HWID status
  const hwidStatus = key.hwidHash ? '🔒 Bound' : '🔓 Not Bound';

  // Expiration
  let expiresText = '♾️ Never (Permanent)';
  if (key.expiresAt) {
    expiresText = isExpired
      ? `~~${formatDateFull(key.expiresAt)}~~ (Expired)`
      : formatDateFull(key.expiresAt);
  }

  // Build stats embed as a list
  const embed = new EmbedBuilder()
    .setTitle('📊 Key Statistics')
    .setColor(isExpired || !key.isActive ? config.colors.error : config.colors.success)
    .setDescription(
      `**📈 Total Executions:** \`${key.totalExecutions || 0}\`\n` +
      `**🖥️ HWID Status:** ${hwidStatus}\n` +
      `**🔑 Key:** ||${key.key}||\n` +
      `**🔄 Total HWID Resets:** \`${key.totalHwidResets || 0}\`\n` +
      `**⏱️ Last Reset:** ${key.lastHwidReset ? formatDate(key.lastHwidReset) : 'Never'}\n` +
      `**📅 Expires At:** ${expiresText}\n` +
      `**🚫 Banned:** ${key.isActive ? 'No' : 'Yes'}\n` +
      `**📋 Status:** ${status}` +
      (key.lastUsedAt ? `\n**🕐 Last Used:** ${formatDate(key.lastUsedAt)}` : '') +
      (key.lastExecutor ? `\n**💻 Last Executor:** \`${key.lastExecutor}\`` : '')
    )
    .setFooter({ text: 'Wisper Hub' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
module.exports = {
  async handle(interaction) {
    const handlers = {
      redeem_key: handleRedeemKey,
      relink_key: handleRelinkKey,
      cancel_relink: handleCancelRelink,
      get_script: handleGetScript,
      reset_hwid: handleResetHwid,
      confirm_reset_hwid: handleConfirmResetHwid,
      cancel_reset_hwid: handleCancelResetHwid,
      view_stats: handleViewStats,
    };

    const handler = handlers[interaction.customId];

    if (handler) {
      await handler(interaction);
    } else {
      console.warn(`Unknown button: ${interaction.customId}`);
      await interaction.reply({
        content: '❌ Unknown button interaction.',
        ephemeral: true,
      });
    }
  },
};
