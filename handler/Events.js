const fs = require('fs');
const path = require('path');

module.exports = {
  run: (client) => {
    const pastaEventos = path.join(__dirname, '../Eventos');
    if (!fs.existsSync(pastaEventos)) return;

    const carregarEventos = (caminhoPasta) => {
      const arquivos = fs.readdirSync(caminhoPasta);
      for (const arquivo of arquivos) {
        const caminhoArquivo = path.join(caminhoPasta, arquivo);
        const stat = fs.lstatSync(caminhoArquivo);
        if (stat.isDirectory()) {
          carregarEventos(caminhoArquivo);
          continue;
        }
        if (arquivo.endsWith('.js')) {
          try {
            const exportado = require(caminhoArquivo);
            if (typeof exportado.init === 'function') {
              exportado.init(client);
              continue;
            }
            const eventos = Array.isArray(exportado) ? exportado : [exportado];
            for (const evento of eventos) {
              if (!evento || typeof evento.run !== 'function' || !evento.name) continue;
              if (evento.once) {
                client.once(evento.name, (...args) => evento.run(...args, client));
              } else {
                client.on(evento.name, (...args) => evento.run(...args, client));
              }
            }
          } catch (erro) {}
        }
      }
    };

    try {
      carregarEventos(pastaEventos);
    } catch (erro) {}
  },
};
