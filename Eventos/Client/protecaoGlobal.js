const chalk = require('chalk');
const config = require('../../config.json');
const honeypot = require('../../Eventos/Client/honeypot');
const punicaoGlobal = require('../../Eventos/Client/punicaoGlobal');

const INTERVALO_REAPLICACAO = config.automod?.intervaloReaplicacao ?? 43200000;

module.exports = {
  init(client) {
    client.once('clientReady', async () => {
      try {
        await honeypot.garantirTodos(client);
        await punicaoGlobal.reaplicarCastigos(client);
        console.log(chalk.green('[PROTECAO]'), 'Honeypots verificados e castigos globais sincronizados.');
      } catch (erro) {
        console.error(chalk.red('[PROTECAO]'), 'Falha na inicialização:', erro.message);
      }

      setInterval(() => {
        punicaoGlobal.reaplicarCastigos(client).catch(() => {});
      }, INTERVALO_REAPLICACAO);
    });

    client.on('guildCreate', (guild) => {
      honeypot.garantirCanal(guild).catch(() => {});
    });

    client.on('guildMemberAdd', async (membro) => {
      if (membro.user.bot) return;
      if (!punicaoGlobal.estaCastigado(membro.id)) return;
      if (!membro.moderatable) return;

      await membro
        .timeout(config.automod?.duracaoCastigoMs ?? 2419200000, 'Castigo global permanente WolfSide Protect')
        .catch(() => {});
    });
  },
};
