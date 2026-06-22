const { MessageFlags, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const config = require('../../config.json');
const honeypot = require('../../Eventos/Client/honeypot');
const punicaoGlobal = require('../../Eventos/Client/punicaoGlobal');
const { ehImune } = require('../../Eventos/Client/imunidade');

const REGEX_CONVITE = /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord(?:\.|\s?dot\s?)gg|discord\.me|dsc\.gg|dis\.gd|invite\.gg|disboard\.org\/server\/join)\/[a-z0-9-_]+/i;

const LIMITE = config.automod?.antiSpamImagens ?? {};
const MINIMO_IMAGENS = LIMITE.minimoImagens ?? 4;
const MINIMO_CANAIS = LIMITE.minimoCanais ?? 2;
const INTERVALO = LIMITE.intervalo ?? 120000;
const DURACAO_AVISO = config.automod?.antiLink?.duracaoAvisoMs ?? 6000;

const rastreador = new Map();

const contarImagens = (message) =>
  message.attachments.filter((anexo) =>
    anexo.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(anexo.name ?? '')
  ).size;

const enviarAvisoTemporario = async (canal, conteudo) => {
  const aviso = await canal.send({
    components: [new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(conteudo)
    )],
    flags: MessageFlags.IsComponentsV2,
  }).catch(() => null);

  if (aviso) setTimeout(() => aviso.delete().catch(() => {}), DURACAO_AVISO);
};

const UM_DIA_MS = 86400000;

const MAX_CANAIS = 30;
const MAX_LOTES_POR_CANAL = 3;

const apagarMensagensRecentes = async (guild, usuarioId) => {
  const limite = Date.now() - UM_DIA_MS;
  const me = guild.members.me;
  let total = 0;

  const canais = guild.channels.cache
    .filter(
      (canal) =>
        canal.isTextBased?.() &&
        !canal.isThread?.() &&
        canal.viewable &&
        canal.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)
    )
    .first(MAX_CANAIS);

  for (const canal of canais.values()) {
    let antes;

    for (let i = 0; i < MAX_LOTES_POR_CANAL; i++) {
      const lote = await canal.messages.fetch({ limit: 100, before: antes }).catch(() => null);
      if (!lote || lote.size === 0) break;

      antes = lote.last().id;

      const apagaveis = lote.filter(
        (m) => m.author.id === usuarioId && m.createdTimestamp >= limite && m.bulkDeletable
      );

      if (apagaveis.size > 0) {
        const removidas = await canal.bulkDelete(apagaveis, true).catch(() => null);
        total += removidas?.size ?? 0;
      }

      if (lote.last().createdTimestamp < limite) break;
    }
  }

  return total;
};

const tratarHoneypot = async (message, client) => {
  try {
    await message.delete().catch(() => {});

    const total = punicaoGlobal.registrarComprometido();
    const motivo = 'WolfSide Protect — mensagem em canal honeypot (conta comprometida)';

    await punicaoGlobal.aplicarCastigoGlobal(client, message.author.id, motivo);

    const apagadas = await apagarMensagensRecentes(message.guild, message.author.id);

    honeypot.atualizarContadores(client).catch(() => {});

    client.emit('automodLog', {
      tipo: 'honeypot',
      servidor: message.guild,
      usuario: message.author,
      motivo: `Enviou mensagem no canal honeypot \`#${message.channel.name}\``,
      detalhe: `Conta comprometida nº **${total}** — castigo global permanente · **${apagadas}** mensagens removidas (24h)`,
      horario: Date.now(),
    });
  } catch (erro) {
    console.error('[AUTOMOD-HONEYPOT]', erro.message);
  }
};

const tratarSpamImagens = async (message, client) => {
  const quantidade = contarImagens(message);
  if (quantidade === 0) return false;

  const chave = `${message.guild.id}:${message.author.id}`;
  const agora = Date.now();
  const eventos = (rastreador.get(chave) ?? []).filter((e) => agora - e.horario < INTERVALO);

  eventos.push({ horario: agora, canalId: message.channel.id, quantidade, mensagemId: message.id, canal: message.channel });
  rastreador.set(chave, eventos);

  const totalImagens = eventos.reduce((soma, e) => soma + e.quantidade, 0);
  const canaisDistintos = new Set(eventos.map((e) => e.canalId)).size;

  if (totalImagens < MINIMO_IMAGENS || canaisDistintos < MINIMO_CANAIS) return false;

  rastreador.delete(chave);

  try {
    for (const evento of eventos) {
      await evento.canal.messages.delete(evento.mensagemId).catch(() => {});
    }

    const motivo = `WolfSide Protect — flood de ${totalImagens} imagens em ${canaisDistintos} canais (anti-MrBeast)`;
    await punicaoGlobal.aplicarCastigoGlobal(client, message.author.id, motivo);

    client.emit('automodLog', {
      tipo: 'spam_imagens',
      servidor: message.guild,
      usuario: message.author,
      motivo: `Enviou **${totalImagens}** imagens em **${canaisDistintos}** canais em menos de ${INTERVALO / 60000} min`,
      detalhe: 'Castigo global aplicado em todos os servidores',
      horario: agora,
    });
  } catch (erro) {
    console.error('[AUTOMOD-SPAM]', erro.message);
  }

  return true;
};

const tratarLink = async (message) => {
  if (!REGEX_CONVITE.test(message.content)) return false;

  await message.delete().catch(() => {});
  await enviarAvisoTemporario(
    message.channel,
    `<@${message.author.id}>, envio de **convites do Discord** é permitido apenas para administradores.`
  );

  return true;
};

module.exports = {
  name: 'messageCreate',
  async run(message, client) {
    try {
      if (!message.guild || message.author?.bot || message.system) return;

      const membro = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);

      if (honeypot.ehHoneypot(message.guild.id, message.channel.id)) {
        if (ehImune(membro)) return;
        await tratarHoneypot(message, client);
        return;
      }

      if (ehImune(membro)) return;

      if (await tratarLink(message)) return;
      await tratarSpamImagens(message, client);
    } catch (erro) {
      console.error('[AUTOMOD]', erro.message);
    }
  },
};
