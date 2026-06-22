const { PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const LOGO = 'https://public-blob.squarecloud.dev/1004136030661779517/WolfSide_ZonaSulStore_Png_1_.png';

module.exports = {
  name: 'adicionarbot',
  description: '📩 Gera um link para adicionar o bot em servidores',
  default_member_permissions: PermissionFlagsBits.Administrator,

  run: async (client, interaction) => {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Você não possui permissao para usar este comando.')
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const linkConvite = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${PermissionFlagsBits.Administrator}&scope=bot%20applications.commands`;

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# 🤖 Link de Convite do Bot\n\n` +
                `Clique no botao abaixo para adicionar o **${client.user.username}** em seu servidor.\n\n` +
                `-# ID do Bot: \`${client.user.id}\``
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(LOGO))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

      const botaoConvite = new ButtonBuilder()
        .setLabel('Adicionar Bot')
        .setStyle(ButtonStyle.Link)
        .setEmoji('<:linkalt:1314278640971940000>')
        .setURL(linkConvite);

      const row = new ActionRowBuilder().addComponents(botaoConvite);

      await interaction.editReply({
        components: [container, row],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (erro) {
      console.error('[AdicionarBot] Erro ao gerar link:', erro);

      const resposta = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Ocorreu um erro ao gerar o link: ${erro.message}`)
      );

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          components: [resposta],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});
      }

      return interaction.reply({
        components: [resposta],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      }).catch(() => {});
    }
  },
};