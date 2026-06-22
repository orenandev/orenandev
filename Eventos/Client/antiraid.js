const { AuditLogEvent, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const config = require("../../config.json");

const PERMS_PERIGOSAS = [
  PermissionsBitField.Flags.Administrator,
  PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ManageWebhooks,
  PermissionsBitField.Flags.KickMembers,
  PermissionsBitField.Flags.BanMembers,
];

const rastreador = new Map();

async function isIntocavel(guild, executorId, client) {
  if (executorId === guild.ownerId) return true;
  try {
    const botMembro = await guild.members.fetch(client.user.id);
    const executor  = await guild.members.fetch(executorId);
    return executor.roles.highest.position >= botMembro.roles.highest.position;
  } catch {
    return false;
  }
}

function buscarDados(idServidor, idUsuario) {
  const chave = `${idServidor}:${idUsuario}`;
  if (!rastreador.has(chave)) {
    rastreador.set(chave, { canais: [], cargos: [], banimentos: [], expulsoes: [], webhooks: [] });
  }
  return rastreador.get(chave);
}

async function removerTodosCargos(guild, executorId, motivo) {
  try {
    const membro = await guild.members.fetch(executorId);
    const cargos = membro.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .map(r => ({ id: r.id, nome: r.name }));
    await membro.roles.set([], motivo);
    return { membro, cargos };
  } catch {
    return null;
  }
}

async function onAuditLog(entry, guild, client) {
  const { action, executorId } = entry;
  if (!executorId || executorId === client.user.id) return;

  const dados = buscarDados(guild.id, executorId);
  const agora = Date.now();
  let acaoDetectada = null;
  let motivo = null;

  if (action === AuditLogEvent.ChannelDelete) {
    dados.canais = dados.canais.filter(t => agora - t < config.antiraid.limites.intervaloCanais);
    dados.canais.push(agora);
    if (dados.canais.length >= config.antiraid.limites.canais) {
      acaoDetectada = "exclusao_canal";
      motivo = `Anti-Raid: Deletou ${dados.canais.length} canais em ${config.antiraid.limites.intervaloCanais / 60000}min`;
    }
  }

  if (action === AuditLogEvent.RoleDelete) {
    dados.cargos = dados.cargos.filter(t => agora - t < config.antiraid.limites.intervaloCargos);
    dados.cargos.push(agora);
    if (dados.cargos.length >= config.antiraid.limites.cargos) {
      acaoDetectada = "exclusao_cargo";
      motivo = `Anti-Raid: Deletou ${dados.cargos.length} cargos em ${config.antiraid.limites.intervaloCargos / 60000}min`;
    }
  }

  if (action === AuditLogEvent.MemberBanAdd) {
    dados.banimentos = dados.banimentos.filter(t => agora - t < config.antiraid.limites.intervaloBans);
    dados.banimentos.push(agora);
    if (dados.banimentos.length >= config.antiraid.limites.bans) {
      acaoDetectada = "banimento_massa";
      motivo = `Anti-Raid: Baniu ${dados.banimentos.length} membros em ${config.antiraid.limites.intervaloBans / 1000}s`;
    }
  }

  if (action === AuditLogEvent.MemberKick) {
    dados.expulsoes = dados.expulsoes.filter(t => agora - t < config.antiraid.limites.intervaloKicks);
    dados.expulsoes.push(agora);
    if (dados.expulsoes.length >= config.antiraid.limites.kicks) {
      acaoDetectada = "expulsao_massa";
      motivo = `Anti-Raid: Expulsou ${dados.expulsoes.length} membros em ${config.antiraid.limites.intervaloKicks / 1000}s`;
    }
  }

  if (action === AuditLogEvent.WebhookCreate) {
    dados.webhooks = dados.webhooks.filter(t => agora - t < config.antiraid.limites.intervaloWebhooks);
    dados.webhooks.push(agora);
    if (dados.webhooks.length >= config.antiraid.limites.webhooks) {
      acaoDetectada = "webhook_massa";
      motivo = `Anti-Raid: Criou ${dados.webhooks.length} webhooks em ${config.antiraid.limites.intervaloWebhooks / 1000}s`;
    }
  }

  if (action === AuditLogEvent.RoleUpdate) {
    const mudancaPerms = entry.changes?.find(c => c.key === "permissions");
    if (mudancaPerms) {
      const antigas = new PermissionsBitField(BigInt(mudancaPerms.old ?? "0"));
      const novas = new PermissionsBitField(BigInt(mudancaPerms.new ?? "0"));
      const adicionadas = PERMS_PERIGOSAS.filter(p => !antigas.has(p) && novas.has(p));
      if (adicionadas.length > 0) {
        acaoDetectada = "cargo_perigoso";
        motivo = `Anti-Raid: Adicionou ${adicionadas.length} permissão(ões) perigosa(s) a um cargo`;
      }
    }
  }

  if (action === AuditLogEvent.GuildUpdate) {
    const mudancas = entry.changes ?? [];
    const verificacao = mudancas.find(c => c.key === "verification_level");
    const mfa = mudancas.find(c => c.key === "mfa_level");
    if ((verificacao && verificacao.new < verificacao.old) || (mfa && mfa.new === 0)) {
      acaoDetectada = "atualizacao_servidor";
      motivo = `Anti-Raid: Reduziu a segurança do servidor`;
    }
  }

  if (action === AuditLogEvent.MemberPrune) {
    const removidos = entry.extra?.removed ?? "?";
    acaoDetectada = "prune_membros";
    motivo = `Anti-Raid: Removeu ${removidos} membros via prune`;
  }

  if (!acaoDetectada) return;

  if (await isIntocavel(guild, executorId, client)) return;

  rastreador.delete(`${guild.id}:${executorId}`);

  const resultado = await removerTodosCargos(guild, executorId, motivo);

  client.emit("antiraidLog", {
    servidor: guild,
    idExecutor: executorId,
    membro: resultado?.membro ?? null,
    cargosRemovidos: resultado?.cargos ?? [],
    acaoDetectada,
    motivo,
    horario: agora,
  });
}

async function onMemberAdd(member, client) {
  if (!member.user.bot) return;

  const guild = member.guild;

  const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd }).catch(() => null);
  const entry = logs?.entries.find(e => e.target?.id === member.id);
  const executorId = entry?.executorId ?? null;

  if (executorId && await isIntocavel(guild, executorId, client)) return;

  await member.kick("Anti-Bot: Bot não autorizado").catch(() => {});

  let membro = null;
  let cargosRemovidos = [];

  if (executorId) {
    try {
      membro = await guild.members.fetch(executorId);
      cargosRemovidos = membro.roles.cache
        .filter(r => r.id !== guild.id && !r.managed)
        .map(r => ({ id: r.id, nome: r.name }));
      await membro.roles.set([], "Anti-Bot: Adicionou bot não autorizado");
    } catch {}
  }

  client.emit("antiraidLog", {
    servidor: guild,
    idExecutor: executorId,
    membro,
    cargosRemovidos,
    acaoDetectada: "bot_adicionado",
    motivo: `Bot **${member.user.username}** (\`${member.id}\`) adicionado e expulso`,
    horario: Date.now(),
  });
}

async function onInteraction(interaction, client) {
  if (!interaction.isButton() || !interaction.customId.startsWith("info_server:")) return;

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.customId.split(":")[1];
  const guild = await client.guilds.fetch(guildId).catch(() => null);

  if (!guild) {
    return interaction.editReply({ content: "Servidor não encontrado." });
  }

  await guild.fetch();

  const entrou = guild.joinedAt;

  const canalConvite = guild.channels.cache.find(
    c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has("CreateInstantInvite")
  );
  const convite = canalConvite
    ? await canalConvite.createInvite({ maxAge: 300, maxUses: 1, reason: "Log Info Server" }).catch(() => null)
    : null;

  const components = [
    new ContainerBuilder()
      .setAccentColor(0x5865F2)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 🏠 Informações do Servidor")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Servidor\n**${guild.name}**  •  \`${guild.id}\`\n\n` +
          `-# Dono\n<@${guild.ownerId}> (\`${guild.ownerId}\`)\n\n` +
          `-# Bot Entrou\n<t:${Math.floor(entrou.getTime() / 1000)}:F>\n\n` +
          `-# Membros\n\`${guild.memberCount}\` membros\n\n` +
          `-# Convite\n${convite ? convite.url : "Não foi possível gerar"}`
        )
      ),
  ];

  return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
  init(client) {
    client.on("guildAuditLogEntryCreate", (entry, guild) => onAuditLog(entry, guild, client));
    client.on("guildMemberAdd", (member) => onMemberAdd(member, client));
    client.on("interactionCreate", (interaction) => onInteraction(interaction, client));
  },
};
