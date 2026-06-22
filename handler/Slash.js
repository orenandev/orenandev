  const fs = require("fs");
  const path = require("path");

  module.exports = async (client) => {
    const arrayComandos = [];
    const pastaComandos = path.join(__dirname, "../Comandos");

    const carregarComandos = (caminhoPasta) => {
      const arquivos = fs.readdirSync(caminhoPasta);
      for (const arquivo of arquivos) {
        const caminhoArquivo = path.join(caminhoPasta, arquivo);
        const stat = fs.lstatSync(caminhoArquivo);
        if (stat.isDirectory()) {
          carregarComandos(caminhoArquivo);
          continue;
        }
        if (arquivo.endsWith(".js")) {
          try {
            const comando = require(caminhoArquivo);
            if (comando.name) {
              client.slashCommands.set(comando.name, comando);
              arrayComandos.push(comando);
            }
          } catch (erro) {}
        }
      }
    };

    carregarComandos(pastaComandos);

    client.once("ready", async () => {
      try {
        await Promise.all(
          client.guilds.cache.map((servidor) =>
            servidor.commands.set(arrayComandos).catch(() => {})
          )
        );
      } catch (erro) {}
    });

    client.on("guildCreate", async (servidor) => {
      try {
        await servidor.commands.set(arrayComandos);
      } catch (erro) {}
    });
  };
