const { Client, GatewayIntentBits, Collection, Partials } = require("discord.js");
const chalk = require("chalk");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]
});

client.slashCommands = new Collection();
client.aliases = new Collection();
client.config = config;

const carregarBot = () => {
  console.log(chalk.blue("[HANDLER]"), "Carregando componentes do sistema...");
  
  try {
    require("./handler/Events").run(client);
    
    require("./handler/Slash")(client);
    
    console.log(chalk.green("[HANDLER]"), "Todos os componentes carregados com sucesso.");
  } catch (error) {
    console.error(chalk.red("[ERROR]"), "Erro ao carregar componentes:", error.message);
  }
};

async function iniciar() {
  try {
    carregarBot();

    console.log(chalk.magenta("[AUTH]"), "Autenticando com o Discord...");
    await client.login(config.autenticacao.token);
  } catch (err) {
    console.error(chalk.red.bold("[CRITICAL]"), "Falha brutal na inicialização:");
    console.error(chalk.red("Mensagem:"), err.message);
    // process.exit(1);
  }
}

client.on("guildMemberAdd", async (membro) => {
  try {
    const sinc = config.sincronizacaoCargos;
    if (!sinc) return;

    if (membro.guild.id !== sinc.serverLogs) return;

    const serverPrincipal = client.guilds.cache.get(sinc.serverPrincipal);
    if (!serverPrincipal) {
      console.warn(chalk.yellow("[SINC-CARGOS]"), "Servidor principal não encontrado no cache.");
      return;
    }

    const membroPrincipal = await serverPrincipal.members.fetch(membro.id).catch(() => null);
    if (!membroPrincipal) return;

    for (const regra of sinc.mapeamento) {
      if (!membroPrincipal.roles.cache.has(regra.cargoPrincipal)) continue;
      if (membro.roles.cache.has(regra.cargoLogs)) continue;

      await membro.roles.add(regra.cargoLogs).then(() => {
        console.log(
          chalk.green("[SINC-CARGOS]"),
          `Cargo "${regra.nome}" atribuído a ${membro.user.tag} no servidor de logs.`
        );
      }).catch((err) => {
        console.error(
          chalk.red("[SINC-CARGOS]"),
          `Falha ao atribuir cargo "${regra.nome}" a ${membro.user.tag}:`, err.message
        );
      });
    }
  } catch (err) {
    console.error(chalk.red("[SINC-CARGOS]"), "Erro na sincronização de cargos:", err.message);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("[ANTI-CRASH]"), "Rejeição não tratada detectada.");
  console.error(reason);
});

process.on("uncaughtException", (err) => {
  console.error(chalk.red.bold("[ANTI-CRASH]"), "Exceção não capturada!");
  console.error(err);
});

process.on("warning", (warning) => {
  if (warning.name === 'DeprecationWarning') return;
  console.warn(chalk.yellow("[WARN]"), warning.name, "-", warning.message);
});

iniciar();