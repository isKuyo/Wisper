// ═══════════════════════════════════════════════════════════════
// MODAL HANDLERS
// Handles all modal submission interactions
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

// ═══════════════════════════════════════════════════════════════
// KEY VALIDATION REGEX
// ═══════════════════════════════════════════════════════════════
const KEY_REGEX = /^WISPER-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ═══════════════════════════════════════════════════════════════
// REDEEM KEY MODAL
// ═══════════════════════════════════════════════════════════════
async function handleRedeemKeyModal(interaction) {
  const prisma = interaction.prisma;
  const config = interaction.config;
  const discordId = interaction.user.id;

  // Get the key from modal input
  const keyInput = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();

  // Validate key format
  if (!KEY_REGEX.test(keyInput)) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Invalid Key Format')
      .setDescription(
        `The key format is invalid.\n\n` +
        `**Expected Format:** \`WISPER-XXXX-XXXX-XXXX-XXXX\`\n` +
        `**Your Input:** \`${keyInput}\``
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Find the key in database
  const key = await prisma.key.findUnique({
    where: { key: keyInput },
  });

  if (!key) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Not Found')
      .setDescription(
        `This key does not exist in our system.\n\n` +
        `Make sure you entered the correct key provided by an admin.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if key is already linked to someone else
  if (key.discordId && key.discordId !== discordId) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Already Linked')
      .setDescription(
        `This key is already linked to another Discord account.\n\n` +
        `Each key can only be linked to one Discord account.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if key is active
  if (!key.isActive) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Disabled')
      .setDescription(
        `This key has been disabled by an administrator.\n\n` +
        `Contact support if you believe this is an error.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if user already has another key linked
  const existingKey = await prisma.key.findUnique({
    where: { discordId: discordId },
  });

  if (existingKey && existingKey.id !== key.id) {
    // Unlink old key first
    await prisma.key.update({
      where: { id: existingKey.id },
      data: { discordId: null },
    });
  }

  // Link the key to this Discord user
  await prisma.key.update({
    where: { id: key.id },
    data: { discordId: discordId },
  });

  // Calculate expiration status
  let expiresText = '♾️ Never (Permanent)';
  if (key.expiresAt) {
    const now = new Date();
    if (new Date(key.expiresAt) < now) {
      expiresText = '⚠️ Expired';
    } else {
      expiresText = `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:R>`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Key Linked Successfully!')
    .setDescription(
      `Your key has been linked to your Discord account.\n\n` +
      `**Key:** ||${key.key}||\n` +
      `**Expires:** ${expiresText}\n\n` +
      `You can now use the **Stats** button to view your key info, and **Reset HWID** to manage your hardware ID.`
    )
    .setColor(config.colors.success)
    .setFooter({ text: 'Wisper Hub' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// RELINK KEY MODAL
// ═══════════════════════════════════════════════════════════════
async function handleRelinkKeyModal(interaction) {
  const prisma = interaction.prisma;
  const config = interaction.config;
  const discordId = interaction.user.id;

  // Get the key from modal input
  const keyInput = interaction.fields.getTextInputValue('key_input').toUpperCase().trim();

  // Validate key format
  if (!KEY_REGEX.test(keyInput)) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Invalid Key Format')
      .setDescription(
        `The key format is invalid.\n\n` +
        `**Expected Format:** \`WISPER-XXXX-XXXX-XXXX-XXXX\`\n` +
        `**Your Input:** \`${keyInput}\``
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Find the new key in database
  const newKey = await prisma.key.findUnique({
    where: { key: keyInput },
  });

  if (!newKey) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Not Found')
      .setDescription(
        `This key does not exist in our system.\n\n` +
        `Make sure you entered the correct key provided by an admin.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if new key is already linked to someone else
  if (newKey.discordId && newKey.discordId !== discordId) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Already Linked')
      .setDescription(
        `This key is already linked to another Discord account.\n\n` +
        `Each key can only be linked to one Discord account.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Check if key is active
  if (!newKey.isActive) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Key Disabled')
      .setDescription(
        `This key has been disabled by an administrator.\n\n` +
        `Contact support if you believe this is an error.`
      )
      .setColor(config.colors.error)
      .setFooter({ text: 'Wisper Hub' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  // Get user's current key and unlink it
  const oldKey = await prisma.key.findUnique({
    where: { discordId: discordId },
  });

  if (oldKey) {
    await prisma.key.update({
      where: { id: oldKey.id },
      data: { discordId: null },
    });
  }

  // Link the new key
  await prisma.key.update({
    where: { id: newKey.id },
    data: { discordId: discordId },
  });

  // Calculate expiration status
  let expiresText = '♾️ Never (Permanent)';
  if (newKey.expiresAt) {
    const now = new Date();
    if (new Date(newKey.expiresAt) < now) {
      expiresText = '⚠️ Expired';
    } else {
      expiresText = `<t:${Math.floor(new Date(newKey.expiresAt).getTime() / 1000)}:R>`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Key Relinked Successfully!')
    .setDescription(
      `Your account has been linked to the new key.\n\n` +
      `**New Key:** ||${newKey.key}||\n` +
      `**Expires:** ${expiresText}\n\n` +
      `Your old key has been unlinked and is now available for another user.`
    )
    .setColor(config.colors.success)
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
      redeem_key_modal: handleRedeemKeyModal,
      relink_key_modal: handleRelinkKeyModal,
    };

    const handler = handlers[interaction.customId];

    if (handler) {
      await handler(interaction);
    } else {
      console.warn(`Unknown modal: ${interaction.customId}`);
      await interaction.reply({
        content: '❌ Unknown modal interaction.',
        ephemeral: true,
      });
    }
  },
};
