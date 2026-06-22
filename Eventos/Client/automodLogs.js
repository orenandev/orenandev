const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,MessageFlags } = require('discord.js');
const config = require('../../config.json');

const TITULOS = {
  honeypot: '🚨 Honeypot — Conta Comprometida',
  spam_imagens: '🖼️ Anti-Flood — Spam de Imagens',
};

module.exports = {
  name: 'automodLog',
  async run(dados, client) {
    const canalId = config.logs?.canallogs;
    if (!canalId) return;

    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal) return;

    const { tipo, servidor, usuario, motivo, detalhe, horario } = dados;
    const titulo = TITULOS[tipo] ?? '⚠️ AutoMod';

    const components = [
      new ContainerBuilder()
        .setAccentColor(0xed4245)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${titulo}`))
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Servidor\n**${servidor.name}** \`${servidor.id}\`\n\n` +
            `-# Usuário\n<@${usuario.id}> (\`${usuario.id}\`)\n\n` +
            `-# Motivo\n${motivo}\n\n` +
            (detalhe ? `-# Detalhe\n${detalhe}\n\n` : '') +
            `-# Horário\n<t:${Math.floor(horario / 1000)}:F>`
          )
        ),
    ];

    await canal.send({ components, flags: MessageFlags.IsComponentsV2 }).catch((erro) => {
      console.error('[AUTOMOD-LOGS]', 'Falha ao enviar log:', erro.message);
    });
  },
};
