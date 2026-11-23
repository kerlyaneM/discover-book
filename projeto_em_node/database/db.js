const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'banco.db'), (err) => {
  if (err) console.error('Erro ao conectar:', err.message);
  else console.log('SQLite conectado');
});

db.serialize(() => {
 db.run(`
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    username TEXT,
    bio TEXT,
    foto TEXT,
    avatar TEXT,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'doador',
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

  // Colunas novas em bancos já existentes (ignora erro se já existir).
  // Importante: SQLite não permite ADD COLUMN com valor padrão não-constante
  // (ex: CURRENT_TIMESTAMP), então data_criacao é criada sem default e
  // depois preenchida via UPDATE para quem estiver nula.
  db.run(`ALTER TABLE usuarios ADD COLUMN username TEXT`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN avatar TEXT`, () => {});
  // Avatares novos (doador-XX.png / escola-XX.svg) substituíram os antigos avatar1..6.svg.
  // Quem já tinha escolhido um antigo passa pro equivalente novo (não roda de novo: depois não sobra avatarN.svg).
  [1, 2, 3, 4, 5, 6].forEach((n) => {
    db.run(`UPDATE usuarios SET avatar = ? WHERE avatar = ? AND tipo = 'escola'`, ["escola-0" + n + ".svg", "avatar" + n + ".svg"], () => {});
    db.run(`UPDATE usuarios SET avatar = ? WHERE avatar = ? AND (tipo IS NULL OR tipo != 'escola')`, ["doador-0" + n + ".png", "avatar" + n + ".svg"], () => {});
  });
  db.run(`ALTER TABLE usuarios ADD COLUMN data_criacao DATETIME`, () => {
    db.run(`UPDATE usuarios SET data_criacao = CURRENT_TIMESTAMP WHERE data_criacao IS NULL`, () => {});
  });
  // admin = 0/1 -> marca quem da equipe pode acessar o painel de pedidos (/admin/pedidos)
  db.run(`ALTER TABLE usuarios ADD COLUMN admin INTEGER DEFAULT 0`, () => {});
  // Informações públicas que a ESCOLA preenche em Editar perfil e aparecem em /escola/:id
  // (nunca e-mail nem telefone). etapas = lista separada por vírgula.
  db.run(`ALTER TABLE usuarios ADD COLUMN cidade TEXT`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN etapas TEXT`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN alunos INTEGER`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN necessidades TEXT`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN instagram TEXT`, () => {});

  // Preferências (página Configurações). 1 = ligado, 0 = desligado; quem já tinha conta fica com tudo ligado.
  //  - mostrar_ranking: doador aparece no ranking de doadores para os outros
  //  - mostrar_relatos: doador vê no perfil os relatos das escolas sobre os livros que doou
  //  - aceita_doacoes: escola aparece na lista de destinos da página /doar
  db.run(`ALTER TABLE usuarios ADD COLUMN mostrar_ranking INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN mostrar_relatos INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE usuarios ADD COLUMN aceita_doacoes INTEGER DEFAULT 1`, () => {});

  // Doação com destino: o doador escolhe a escola que vai receber o livro.
  // NULL = doações antigas, que continuam abertas para qualquer escola pedir.
  db.run(`ALTER TABLE doacoes ADD COLUMN escola_destino_id INTEGER`, () => {});

  db.run(`
  CREATE TABLE IF NOT EXISTS doacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  livro TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  foto TEXT,
  status TEXT DEFAULT 'disponivel',
  data_envio DATETIME DEFAULT CURRENT_TIMESTAMP
)
  `);

  db.run(`ALTER TABLE doacoes ADD COLUMN usuario_id INTEGER`, () => {});
  db.run(`ALTER TABLE doacoes ADD COLUMN foto TEXT`, () => {});
  db.run(`ALTER TABLE doacoes ADD COLUMN descricao TEXT`, () => {});
  // status controla se o livro já está disponível pra quem quiser solicitar
  // (por enquanto toda doação enviada já entra disponível no acervo)
  db.run(`ALTER TABLE doacoes ADD COLUMN status TEXT`, () => {
    db.run(`UPDATE doacoes SET status = 'disponivel' WHERE status IS NULL`, () => {});
  });

  db.run(`
  CREATE TABLE IF NOT EXISTS solicitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  escola TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  cidade TEXT NOT NULL,
  telefone TEXT,
  livro TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  obs TEXT,
  status TEXT DEFAULT 'recebida',
  data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao DATETIME
)
  `);

  // Colunas novas em bancos já existentes (mesma lógica das colunas de usuarios acima).
  db.run(`ALTER TABLE solicitacoes ADD COLUMN telefone TEXT`, () => {});
  db.run(`ALTER TABLE solicitacoes ADD COLUMN status TEXT`, () => {
    db.run(`UPDATE solicitacoes SET status = 'recebida' WHERE status IS NULL`, () => {});
  });
  db.run(`ALTER TABLE solicitacoes ADD COLUMN data_atualizacao DATETIME`, () => {
    db.run(`UPDATE solicitacoes SET data_atualizacao = data_envio WHERE data_atualizacao IS NULL`, () => {});
  });

  // ===================== REPASSES (escola -> escola) =====================
  // Fluxo separado do doador -> escola: uma escola cadastra um livro
  // excedente (que já não usa mais / está duplicado), ele fica visível
  // pra outras escolas solicitarem, e a escola de origem aprova ou recusa
  // o pedido (mesma ideia da aprovação que já existe hoje, só que entre
  // escolas). Ciclo de status:
  //
  //   disponivel -> solicitado -> aprovado (conta pro ranking "Escolas parceiras")
  //        \-> cancelado (a origem cancela enquanto está "disponivel")
  //   solicitado -> disponivel (a origem recusa o pedido, livro volta a ficar visível)
  //
  // Doação direta (a escola escolhe a escola que vai receber, na aba "Escolas"):
  //   oferecido -> aprovado (a escola escolhida aceita; conta pro ranking)
  //   oferecido -> recusado (a escola escolhida recusa)
  //   oferecido -> cancelado (a origem cancela enquanto ninguém respondeu)
  db.run(`
  CREATE TABLE IF NOT EXISTS repasses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  escola_origem_id INTEGER NOT NULL,
  escola_destino_id INTEGER,
  livro TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'disponivel',
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao DATETIME
)
  `);

  // ===================== RELATOS (escola mostra o livro em uso) =====================
  // Depois que um pedido é marcado como "entregue", a escola pode publicar uma
  // foto + uma frase mostrando o livro sendo usado. Isso aparece no mural da
  // página pública da escola (/escola/:id) e avisa os doadores daquele título
  // no perfil deles. O título do livro é copiado pra cá (mesma lógica do acervo,
  // que agrupa doações pelo título) porque pedidos e doações não têm vínculo direto.
  db.run(`
  CREATE TABLE IF NOT EXISTS relatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  escola_id INTEGER NOT NULL,
  solicitacao_id INTEGER NOT NULL,
  livro TEXT NOT NULL,
  foto TEXT NOT NULL,
  frase TEXT NOT NULL,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
  `);
});

module.exports = db;