// ═══════════════════════════════════════════════════════════════
// /SCRIPT COMMAND
// Sends the main Wisper Hub panel with action buttons
// ═══════════════════════════════════════════════════════════════

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('script')
    .setDescription('Display the Wisper Hub panel with key management options'),

  async execute(interaction) {
    const config = interaction.config;

    // Create the main embed
    const embed = new EmbedBuilder()
      .setTitle('WISPER')
      .setDescription(
        `Welcome to **Wisper Hub**!\n\n` +
        `Use the buttons below to manage your key and access scripts.`
      )
      .setColor(config.colors.primary)
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({
        text: 'Wisper Hub',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Create buttons row (all in one row)
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('redeem_key')
        .setLabel('Redeem Key')
        .setStyle(ButtonStyle.Success), // Green

      new ButtonBuilder()
        .setCustomId('get_script')
        .setLabel('Get Script')
        .setStyle(ButtonStyle.Primary), // Blue

      new ButtonBuilder()
        .setCustomId('reset_hwid')
        .setLabel('Reset HWID')
        .setStyle(ButtonStyle.Danger), // Red

      new ButtonBuilder()
        .setCustomId('view_stats')
        .setLabel('Stats')
        .setStyle(ButtonStyle.Secondary), // Gray

      new ButtonBuilder()
        .setLabel('Site')
        .setStyle(ButtonStyle.Link)
        .setURL(config.siteUrl),
    );

    // Send as a separate message (not a reply)
    await interaction.deferReply();
    await interaction.deleteReply();
    await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });
  },
};
