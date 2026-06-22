const armazenamento = require('./armazenamento');
const config = require('../../config.json');

const ARQUIVO = 'punicoesGlobais.json';
const PADRAO = { banidos: [], castigados: [], contasComprometidas: 0 };
const DURACAO_CASTIGO = config.automod?.duracaoCastigoMs ?? 2419200000;

const carregar = () => ({ ...PADRAO, ...armazenamento.ler(ARQUIVO, PADRAO) });
const salvar = (estado) => armazenamento.escrever(ARQUIVO, estado);

const estaCastigado = (usuarioId) => carregar().castigados.includes(usuarioId);
const estaBanido = (usuarioId) => carregar().banidos.includes(usuarioId);

const totalComprometidos = () => carregar().contasComprometidas;

const registrarComprometido = () => {
  const estado = carregar();
  estado.contasComprometidas += 1;
  salvar(estado);
  return estado.contasComprometidas;
};

const aplicarCastigoGlobal = async (client, usuarioId, motivo) => {
  const aplicados = [];
  const falhas = [];

  for (const [, servidor] of client.guilds.cache) {
    const membro = await servidor.members.fetch(usuarioId).catch(() => null);
    if (!membro) continue;
    if (!membro.moderatable) {
      falhas.push(servidor.name);
      continue;
    }

    try {
      await membro.timeout(DURACAO_CASTIGO, motivo);
      aplicados.push(servidor.name);
    } catch {
      falhas.push(servidor.name);
    }
  }

  const estado = carregar();
  if (!estado.castigados.includes(usuarioId)) {
    estado.castigados.push(usuarioId);
    salvar(estado);
  }

  return { aplicados, falhas };
};

const aplicarBanGlobal = async (client, usuarioId, motivo) => {
  const aplicados = [];
  const falhas = [];

  for (const [, servidor] of client.guilds.cache) {
    try {
      await servidor.bans.create(usuarioId, { reason: motivo, deleteMessageSeconds: 60 });
      aplicados.push(servidor.name);
    } catch {
      falhas.push(servidor.name);
    }
  }

  const estado = carregar();
  if (!estado.banidos.includes(usuarioId)) {
    estado.banidos.push(usuarioId);
    salvar(estado);
  }

  return { aplicados, falhas };
};

const removerCastigoGlobal = async (client, usuarioId = null, motivo = 'Remoção de punição global') => {
  const estado = carregar();
  const alvos = usuarioId ? [usuarioId] : [...estado.castigados];
  const relatorio = [];

  for (const alvo of alvos) {
    let removidos = 0;

    for (const [, servidor] of client.guilds.cache) {
      const membro = await servidor.members.fetch(alvo).catch(() => null);
      if (!membro?.communicationDisabledUntil) continue;

      try {
        await membro.timeout(null, motivo);
        removidos += 1;
      } catch {}
    }

    estado.castigados = estado.castigados.filter((id) => id !== alvo);
    relatorio.push({ usuarioId: alvo, servidores: removidos });
  }

  salvar(estado);
  return relatorio;
};

const removerBanGlobal = async (client, usuarioId = null, motivo = 'Remoção de punição global') => {
  const estado = carregar();
  const alvos = usuarioId ? [usuarioId] : [...estado.banidos];
  const relatorio = [];

  for (const alvo of alvos) {
    let removidos = 0;

    for (const [, servidor] of client.guilds.cache) {
      const banido = await servidor.bans.fetch(alvo).catch(() => null);
      if (!banido) continue;

      try {
        await servidor.bans.remove(alvo, motivo);
        removidos += 1;
      } catch {}
    }

    estado.banidos = estado.banidos.filter((id) => id !== alvo);
    relatorio.push({ usuarioId: alvo, servidores: removidos });
  }

  salvar(estado);
  return relatorio;
};

const reaplicarCastigos = async (client) => {
  const { castigados } = carregar();
  if (castigados.length === 0) return;

  for (const usuarioId of castigados) {
    for (const [, servidor] of client.guilds.cache) {
      const membro = await servidor.members.fetch(usuarioId).catch(() => null);
      if (!membro || !membro.moderatable) continue;

      const expira = membro.communicationDisabledUntilTimestamp ?? 0;
      const restante = expira - Date.now();
      if (restante > DURACAO_CASTIGO / 2) continue;

      await membro.timeout(DURACAO_CASTIGO, 'Manutenção de castigo permanente WolfSide Protect').catch(() => {});
    }
  }
};

module.exports = {
  estaCastigado,
  estaBanido,
  totalComprometidos,
  registrarComprometido,
  aplicarCastigoGlobal,
  aplicarBanGlobal,
  removerCastigoGlobal,
  removerBanGlobal,
  reaplicarCastigos,
};
