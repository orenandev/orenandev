const { ApplicationCommandOptionType, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');

const LOGO = 'https://public-blob.squarecloud.dev/1004136030661779517/WolfSide_ZonaSulStore_Png_1_.png';

module.exports = {
  name: 'expulsar',
  description: '🔨 Expulsa um usuário de todos os servidores onde o bot está',
  options: [
    {
      name: 'usuario',
      type: ApplicationCommandOptionType.User,
      description: 'O usuário a ser expulso',
      required: true,
    }
  ],
  default_member_permissions: PermissionFlagsBits.Administrator,

  run: async (client, interaction) => {
    const serverPrincipal = client.guilds.cache.get(client.config.sincronizacaoCargos.serverPrincipal);

    if (!serverPrincipal) {
      const resposta = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Erro na configuração: servidor principal não encontrado.')
      );

      return interaction.reply({
        components: [resposta],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const membroExecutor = await serverPrincipal.members.fetch(interaction.user.id).catch(() => null);

    if (!membroExecutor) {
      const resposta = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Você não é membro do servidor de diretoria.')
      );

      return interaction.reply({
        components: [resposta],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const cargoDiretoria = [
      client.config.sincronizacaoCargos.mapeamento.find(m => m.nome === 'respgeral')?.cargoPrincipal,
      client.config.sincronizacaoCargos.mapeamento.find(m => m.nome === 'dev')?.cargoPrincipal,
    ].filter(Boolean);

    const temPermissao = cargoDiretoria.some((cargoId) => membroExecutor.roles.cache.has(cargoId));

    if (!temPermissao) {
      const resposta = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Apenas membros da diretoria podem usar este comando.')
      );

      return interaction.reply({
        components: [resposta],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const usuarioAlvo = interaction.options.getUser('usuario');

      if (usuarioAlvo.id === client.user.id) {
        const resposta = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Não é possível expulsar o bot.')
        );

        return interaction.editReply({
          components: [resposta],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (usuarioAlvo.id === interaction.user.id) {
        const resposta = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Você não pode expulsar a si mesmo.')
        );

        return interaction.editReply({
          components: [resposta],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const servidoresComUsuario = [];
      const servidoresExpulsos = [];
      const servidoresErro = [];

      for (const [, servidor] of client.guilds.cache) {
        const membro = await servidor.members.fetch(usuarioAlvo.id).catch(() => null);

        if (!membro) continue;

        servidoresComUsuario.push(servidor);

        try {
          await membro.kick('Expulsão executada pela diretoria');
          servidoresExpulsos.push({
            nome: servidor.name,
            id: servidor.id,
          });
        } catch (erro) {
          servidoresErro.push({
            nome: servidor.name,
            id: servidor.id,
            motivo: erro.message,
          });
        }
      }

      if (servidoresComUsuario.length === 0) {
        const resposta = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`${usuarioAlvo.tag} não foi encontrado em nenhum servidor onde o bot está presente.`)
        );

        return interaction.editReply({
          components: [resposta],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const sucessosTexto = servidoresExpulsos.length > 0
        ? servidoresExpulsos.map((srv) => `• ${srv.nome} (\`${srv.id}\`)`).join('\n')
        : 'Nenhuma';

      const errosTexto = servidoresErro.length > 0
        ? servidoresErro.map((srv) => `• ${srv.nome} - ${srv.motivo}`).join('\n')
        : 'Nenhum';

      const resumoTexto = `Total encontrado: ${servidoresComUsuario.length}\nExpulsões bem-sucedidas: ${servidoresExpulsos.length}\nFalhas: ${servidoresErro.length}`;

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ✅ Expulsão Executada\n\n` +
                `**Usuário:** ${usuarioAlvo.tag}\n\n` +
                `**✅ Expulsões com Sucesso**\n${sucessosTexto}\n\n` +
                `**❌ Erros na Expulsão**\n${errosTexto}\n\n` +
                `**📊 Resumo**\n${resumoTexto}\n\n` +
                `-# Executado por ${interaction.user.tag}`
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(LOGO))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (erro) {
      console.error('[Expulsar] Erro ao executar:', erro);

      const resposta = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Ocorreu um erro ao executar o comando: ${erro.message}`)
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