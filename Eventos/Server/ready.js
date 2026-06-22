const { ActivityType } = require("discord.js");
const chalk = require("chalk");

module.exports = {
  name: "clientReady",
  once: true,
  async run(client) {
    console.clear();

    const guilds   = client.guilds.cache.size;
    const members  = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const channels = client.channels.cache.size;

    console.log(chalk.green("[BOT]"),     `${client.user.tag} iniciado com sucesso`);
    console.log(chalk.blue("[STATS]"),    `${guilds} servidores | ${members} membros | ${channels} canais`);
    console.log(chalk.cyan("[NETWORK]"),  `Latência: ${client.ws.ping}ms | Online: ${client.readyAt.toLocaleString("pt-BR")}`);

    client.user.setActivity(`${guilds} servidores protegidos`, { type: ActivityType.Watching });

    console.log(chalk.magenta("[STATUS]"), "Atividade definida");
    console.log(chalk.green.bold("[READY]"), "Anti-Raid operacional\n");
  },
};
