const { ApplicationCommandOptionType, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const punicaoGlobal = require('../../Eventos/Client/punicaoGlobal');

const LOGO = 'https://public-blob.squarecloud.dev/1004136030661779517/WolfSide_ZonaSulStore_Png_1_.png';

const responder = (interaction, conteudo) =>
  interaction.reply({
    components: [new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(conteudo)
    )],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });

module.exports = {
  name: 'removerpunicao',
  description: '♻️ Remove punições globais (ban ou castigo) de todos os servidores',
  options: [
    {
      name: 'usuario',
      type: ApplicationCommandOptionType.User,
      description: 'Usuário específico (deixe vazio para limpar todos)',
      required: false,
    },
  ],

  run: async (client, interaction) => {
    const serverPrincipal = client.guilds.cache.get(client.config.sincronizacaoCargos.serverPrincipal);
    if (!serverPrincipal) {
      return responder(interaction, 'Erro na configuração: servidor principal não encontrado.');
    }

    const membroExecutor = await serverPrincipal.members.fetch(interaction.user.id).catch(() => null);
    if (!membroExecutor) {
      return responder(interaction, 'Você não é membro do servidor de diretoria.');
    }

    const cargosDiretoria = ['respgeral', 'dev']
      .map((nome) => client.config.sincronizacaoCargos.mapeamento.find((m) => m.nome === nome)?.cargoPrincipal)
      .filter(Boolean);

    if (!cargosDiretoria.some((cargoId) => membroExecutor.roles.cache.has(cargoId))) {
      return responder(interaction, 'Apenas **Dev** e **Responsável Geral** podem usar este comando.');
    }

    const alvo = interaction.options.getUser('usuario');
    const escopo = alvo ? `**${alvo.tag}** (\`${alvo.id}\`)` : '**todos os usuários punidos**';

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# ♻️ Remoção de Punição Global\n\n` +
              `Selecione qual punição deseja remover para ${escopo} em **todos os servidores** do Protect.`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(LOGO))
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rp_ban').setLabel('Remover Banimentos').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
          new ButtonBuilder().setCustomId('rp_castigo').setLabel('Remover Castigos').setStyle(ButtonStyle.Primary).setEmoji('🔇'),
          new ButtonBuilder().setCustomId('rp_cancelar').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        )
      );

    const mensagem = await interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      withResponse: true,
    }).then((r) => r.resource.message);

    let escolha;
    try {
      escolha = await mensagem.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });
    } catch {
      return interaction.editReply({
        components: [new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('⏱️ Tempo esgotado. Nenhuma punição foi removida.')
        )],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    }

    await escolha.deferUpdate();

    if (escolha.customId === 'rp_cancelar') {
      return interaction.editReply({
        components: [new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Operação cancelada.')
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const usuarioId = alvo?.id ?? null;
    const relatorio = escolha.customId === 'rp_ban'
      ? await punicaoGlobal.removerBanGlobal(client, usuarioId)
      : await punicaoGlobal.removerCastigoGlobal(client, usuarioId);

    const rotulo = escolha.customId === 'rp_ban' ? 'Banimentos' : 'Castigos';
    const totalUsuarios = relatorio.length;
    const totalRemocoes = relatorio.reduce((soma, r) => soma + r.servidores, 0);

    const detalhe = totalUsuarios > 0
      ? relatorio.map((r) => `• <@${r.usuarioId}> — ${r.servidores} servidor(es)`).join('\n')
      : 'Nenhuma punição registrada para remover.';

    const resultado = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# ✅ ${rotulo} Removidos\n\n` +
              `**Usuários processados:** ${totalUsuarios}\n` +
              `**Remoções aplicadas:** ${totalRemocoes}\n\n` +
              `${detalhe}\n\n` +
              `-# Executado por ${interaction.user.tag}`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(LOGO))
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    return interaction.editReply({
      components: [resultado],
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => {});
  },
};
