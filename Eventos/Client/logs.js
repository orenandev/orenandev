const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const config = require("../../config.json");

const NOMES = {
  exclusao_canal:       "Exclusão de Canais",
  exclusao_cargo:       "Exclusão de Cargos",
  banimento_massa:      "Banimentos em Massa",
  expulsao_massa:       "Expulsões em Massa",
  bot_adicionado:       "Bot Adicionado",
  webhook_massa:        "Webhooks em Massa",
  cargo_perigoso:       "Cargo com Permissão Perigosa",
  atualizacao_servidor: "Atualização Perigosa do Servidor",
  prune_membros:        "Prune de Membros",
};

const ICONES = {
  exclusao_canal:       "🗑️",
  exclusao_cargo:       "🎭",
  banimento_massa:      "🔨",
  expulsao_massa:       "👢",
  bot_adicionado:       "🤖",
  webhook_massa:        "🪝",
  cargo_perigoso:       "⚔️",
  atualizacao_servidor: "⚙️",
  prune_membros:        "🪓",
};

module.exports = {
  name: "antiraidLog",
  async run(dados, client) {
    const canalId = config.logs?.canallogs;
    if (!canalId) return;

    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal) return;

    const { servidor, idExecutor, membro, cargosRemovidos, acaoDetectada, motivo, horario } = dados;

    const nome        = NOMES[acaoDetectada]  ?? acaoDetectada;
    const icone       = ICONES[acaoDetectada] ?? "⚠️";
    const linhaInfrator = idExecutor
      ? `<@${idExecutor}> (\`${idExecutor}\`)`
      : `**Desconhecido**`;

    const textoCargos = cargosRemovidos.length > 0
      ? cargosRemovidos.map(c => `\`${c.nome}\``).join(", ")
      : "Nenhum cargo encontrado";

    const components = [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${icone} Anti-Raid — ${nome}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Servidor\n**${servidor.name}** \`${servidor.id}\`\n\n` +
            `-# Infrator\n${linhaInfrator}\n\n` +
            `-# Motivo\n${motivo}\n\n` +
            `-# Horário\n<t:${Math.floor(horario / 1000)}:F>`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# Cargos Removidos\n${textoCargos}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`info_server:${servidor.id}`)
              .setLabel("Info Server")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("🏠")
          )
        ),
    ];

    try {
      await canal.send({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (erro) {
      console.error("[LOGS]", "Falha ao enviar log:", erro.message);
    }
  },
};
