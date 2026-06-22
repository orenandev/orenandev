const fs = require('fs');
const path = require('path');

const pastaDados = path.join(__dirname, '..', '..', 'Database');

const garantirPasta = () => {
  if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });
};

const caminhoArquivo = (arquivo) => path.join(pastaDados, arquivo);

const clonar = (valor) => JSON.parse(JSON.stringify(valor));

const ler = (arquivo, padrao = {}) => {
  try {
    garantirPasta();
    const destino = caminhoArquivo(arquivo);
    if (!fs.existsSync(destino)) return clonar(padrao);

    const conteudo = fs.readFileSync(destino, 'utf8').trim();
    if (!conteudo) return clonar(padrao);

    return JSON.parse(conteudo);
  } catch {
    return clonar(padrao);
  }
};

const escrever = (arquivo, dados) => {
  try {
    garantirPasta();
    const destino = caminhoArquivo(arquivo);
    const temporario = `${destino}.tmp`;

    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
    fs.renameSync(temporario, destino);
  } catch (erro) {
    console.error('[ARMAZENAMENTO]', `Falha ao escrever ${arquivo}:`, erro.message);
  }
};

module.exports = { ler, escrever };
