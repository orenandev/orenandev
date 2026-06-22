const { ChannelType, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,SeparatorSpacingSize, MessageFlags } = require('discord.js');

const armazenamento = require('./armazenamento');
const punicaoGlobal = require('./punicaoGlobal');
const config = require('../../config.json');

const ARQUIVO = 'honeypots.json';
const NOME_CANAL = config.automod?.honeypot?.nomeCanal ?? '🚫┊nao-faleaqui';

const carregarRegistro = () => armazenamento.ler(ARQUIVO, {});
const salvarRegistro = (registro) => armazenamento.escrever(ARQUIVO, registro);

const ehHoneypot = (guildId, canalId) => carregarRegistro()[guildId]?.canalId === canalId;

const construirAviso = () => {
  const total = punicaoGlobal.totalComprometidos();

  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## 🚨 NÃO ENVIE NENHUMA MENSAGEM AQUI.')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Este canal é utilizado para impedir contas comprometidas que enviam mensagens para todos os canais.\n\n' +
        '> Qualquer conteúdo enviado aqui resultará em **SOFTBAN**.\n' +
        `> Contas comprometidas: **${total}**`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# WolfSide Protect | 2026')
    );
};

const publicarAviso = async (canal) => {
  const mensagem = await canal.send({
    components: [construirAviso()],
    flags: MessageFlags.IsComponentsV2,
  });
  return mensagem.id;
};

const localizarCanal = async (guild, registro) => {
  const existente = registro[guild.id];

  if (existente?.canalId) {
    const canal = guild.channels.cache.get(existente.canalId)
      ?? await guild.channels.fetch(existente.canalId).catch(() => null);
    if (canal) return canal;
  }

  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === NOME_CANAL
  ) ?? null;
};

const encontrarAviso = async (canal, mensagemId) => {
  if (mensagemId) {
    const mensagem = await canal.messages.fetch(mensagemId).catch(() => null);
    if (mensagem) return mensagem;
  }

  const recentes = await canal.messages.fetch({ limit: 30 }).catch(() => null);
  if (!recentes) return null;

  return recentes.find(
    (m) => m.author.id === canal.client.user.id && m.components?.length > 0
  ) ?? null;
};

const garantirCanal = async (guild) => {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return;

  const registro = carregarRegistro();
  const existente = registro[guild.id];
  let canal = await localizarCanal(guild, registro);

  if (canal) {
    const aviso = await encontrarAviso(canal, existente?.mensagemId);

    if (aviso) {
      if (existente?.canalId !== canal.id || existente?.mensagemId !== aviso.id) {
        registro[guild.id] = { canalId: canal.id, mensagemId: aviso.id };
        salvarRegistro(registro);
      }
      return;
    }

    registro[guild.id] = { canalId: canal.id, mensagemId: await publicarAviso(canal) };
    salvarRegistro(registro);
    return;
  }

  canal = await guild.channels.create({
    name: NOME_CANAL,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ],
    reason: 'WolfSide Protect — canal honeypot anti-conta comprometida',
  }).catch(() => null);

  if (!canal) return;

  registro[guild.id] = { canalId: canal.id, mensagemId: await publicarAviso(canal) };
  salvarRegistro(registro);
};

const garantirTodos = async (client) => {
  for (const [, guild] of client.guilds.cache) {
    await garantirCanal(guild).catch(() => {});
  }
};

const atualizarContadores = async (client) => {
  const registro = carregarRegistro();
  const aviso = construirAviso();

  for (const [guildId, dados] of Object.entries(registro)) {
    if (!dados?.canalId || !dados?.mensagemId) continue;

    const canal = await client.channels.fetch(dados.canalId).catch(() => null);
    if (!canal) continue;

    const mensagem = await canal.messages.fetch(dados.mensagemId).catch(() => null);
    if (!mensagem) continue;

    await mensagem.edit({ components: [aviso], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  }
};

module.exports = { ehHoneypot, garantirCanal, garantirTodos, atualizarContadores, NOME_CANAL };
