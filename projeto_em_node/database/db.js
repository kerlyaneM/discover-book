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
  db.run(`ALTER TABLE usuarios ADD COLUMN data_criacao DATETIME`, () => {
    db.run(`UPDATE usuarios SET data_criacao = CURRENT_TIMESTAMP WHERE data_criacao IS NULL`, () => {});
  });
  // admin = 0/1 -> marca quem da equipe pode acessar o painel de pedidos (/admin/pedidos)
  db.run(`ALTER TABLE usuarios ADD COLUMN admin INTEGER DEFAULT 0`, () => {});

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
});

module.exports = db;