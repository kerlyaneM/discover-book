const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database/db');
const { paraDataUTC, promoverDoacoesPendentes, HORAS_PENDENTE_DOACAO } = require('../database/data-utils');

// Onde as fotos dos livros doados ficam salvas
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (req, file, cb) => {
    const sufixo = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doacao-' + sufixo + path.extname(file.originalname));
  }
});

const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    cb(null, tiposAceitos.includes(file.mimetype));
  }
});

function autenticado(req, res, next) {
    if (req.session && req.session.usuario_id) {
        return next();
    }
    res.redirect('/login');
}

// Página de doação
router.get('/doar', (req, res) => {

  promoverDoacoesPendentes(db, () => {

  db.get(
    `SELECT COALESCE(SUM(quantidade), 0) AS totalExemplares,
            COUNT(DISTINCT livro) AS totalTitulos
     FROM doacoes
     WHERE status = 'disponivel'`,
    [],
    (err, linha) => {

      const stats = {
        exemplares: (!err && linha) ? linha.totalExemplares : 0,
        titulos: (!err && linha) ? linha.totalTitulos : 0
      };

      res.render('doar', {
        usuario: req.session.usuario_nome || null,
        sucesso: req.query.sucesso || null,
        erro: req.query.erro || null,
        pagina: "doar",
        statsAcervo: stats,
        doadorNome: req.session.usuario_nome || '',
        doadorEmail: req.session.email || ''
      });
    }
  );

  });
});

// Enviar doação
router.post('/doar', (req, res, next) => {
  upload.single('foto')(req, res, (erroUpload) => {
    if (erroUpload) {
      return res.redirect('/doar?erro=foto');
    }
    next();
  });
}, (req, res) => {
  const {
    nome,
    email,
    telefone,
    livro,
    categoria,
    quantidade,
    descricao
  } = req.body;

  // Foto agora é obrigatória
  if (!req.file) {
    return res.redirect('/doar?erro=foto');
  }

  const caminhoFoto = '/uploads/' + req.file.filename;

  // A doação nasce "pendente": fica 48h nesse estado, tempo em que o
  // próprio doador pode editar os dados ou cancelar (veja as rotas
  // /doar/:id/editar e /doar/:id/cancelar). Depois desse prazo, vira
  // "disponivel" automaticamente e passa a aparecer no acervo.
  db.run(
    `INSERT INTO doacoes
    (usuario_id, nome, email, telefone, livro, categoria, quantidade, foto, descricao, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
    [req.session.usuario_id || null, nome, email, telefone, livro, categoria, quantidade, caminhoFoto, descricao || null],
    (err) => {
      if (err) {
        console.log(err);
        return res.redirect('/doar?erro=1');
      }

      res.redirect('/doar?sucesso=1');
    }
  );
});

// Acervo: mostra os livros que já foram doados e estão disponíveis pra pedir.
// Doações do MESMO livro (título igual, sem diferenciar maiúsculas/espaços)
// são somadas em um único card, em vez de aparecerem separadas — se a Maria
// doou 2 exemplares de "Dom Casmurro" e o João doou mais 1, o acervo mostra
// "3 disponíveis · doados por 2 pessoas" num card só.
router.get('/acervo', (req, res) => {

  promoverDoacoesPendentes(db, () => {

  db.all(
    `SELECT id, usuario_id, email, livro, categoria, quantidade, foto, data_envio
     FROM doacoes
     WHERE status = 'disponivel'
     ORDER BY data_envio DESC`,
    [],
    (err, doacoes) => {

      if (err) {
        console.log(err);
        return res.render('acervo', {
          livros: [],
          stats: { exemplares: 0, titulos: 0, doadores: 0 },
          pagina: "acervo"
        });
      }

      // Agrupa as doações por título de livro (chave = título normalizado).
      // Como a busca já vem ordenada da mais recente pra mais antiga, o
      // primeiro registro de cada grupo é sempre o mais recente — é dele
      // que tiramos a categoria, a foto de capa e a data mostradas no card.
      const grupos = new Map();
      const doadoresGeral = new Set();

      (doacoes || []).forEach((d) => {
        const chave = (d.livro || '').trim().toLowerCase();
        const identificadorDoador = d.usuario_id || d.email;
        if (identificadorDoador) doadoresGeral.add(identificadorDoador);

        if (!grupos.has(chave)) {
          grupos.set(chave, {
            livro: (d.livro || '').trim(),
            categoria: d.categoria,
            quantidade: 0,
            foto: d.foto || null,
            data_envio: d.data_envio,
            doadores: new Set()
          });
        }

        const grupo = grupos.get(chave);
        grupo.quantidade += Number(d.quantidade) || 0;
        if (!grupo.foto && d.foto) grupo.foto = d.foto; // preenche foto se algum outro exemplar tiver
        if (identificadorDoador) grupo.doadores.add(identificadorDoador);
      });

      const livrosFormatados = Array.from(grupos.values()).map((g) => {
        const data = paraDataUTC(g.data_envio);
        return {
          livro: g.livro,
          categoria: g.categoria,
          quantidade: g.quantidade,
          fotoExibida: g.foto || null,
          totalDoadores: g.doadores.size,
          dataFormatada: data
            ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
            : null
        };
      });

      const stats = {
        exemplares: livrosFormatados.reduce((soma, l) => soma + l.quantidade, 0),
        titulos: livrosFormatados.length,
        doadores: doadoresGeral.size
      };

      res.render('acervo', { livros: livrosFormatados, stats, pagina: "acervo" });
    }
  );

  });

});

// ===================== EDITAR DOAÇÃO (só enquanto está "pendente") =====================
router.get('/doar/:id/editar', autenticado, (req, res) => {

  db.get(
    'SELECT * FROM doacoes WHERE id = ?',
    [req.params.id],
    (err, doacao) => {

      if (err || !doacao) {
        return res.redirect('/perfil?aba=doados&erro=nao_encontrada');
      }

      const dono = doacao.usuario_id
        ? doacao.usuario_id === req.session.usuario_id
        : doacao.email === req.session.email;

      if (!dono) {
        return res.redirect('/perfil?aba=doados&erro=sem_permissao');
      }

      if (doacao.status !== 'pendente') {
        return res.redirect('/perfil?aba=doados&erro=ja_confirmada');
      }

      res.render('editar-doacao', {
        usuario: req.session.usuario_nome || null,
        doacao,
        erro: req.query.erro || null,
        horasPendente: HORAS_PENDENTE_DOACAO
      });
    }
  );

});

router.post('/doar/:id/editar', autenticado, (req, res, next) => {
  upload.single('foto')(req, res, (erroUpload) => {
    if (erroUpload) {
      return res.redirect('/doar/' + req.params.id + '/editar?erro=foto');
    }
    next();
  });
}, (req, res) => {

  const { livro, categoria, quantidade, descricao } = req.body;

  db.get(
    'SELECT * FROM doacoes WHERE id = ?',
    [req.params.id],
    (err, doacao) => {

      if (err || !doacao) {
        return res.redirect('/perfil?aba=doados&erro=nao_encontrada');
      }

      const dono = doacao.usuario_id
        ? doacao.usuario_id === req.session.usuario_id
        : doacao.email === req.session.email;

      if (!dono || doacao.status !== 'pendente') {
        return res.redirect('/perfil?aba=doados&erro=sem_permissao');
      }

      // Se mandou uma foto nova, troca; senão mantém a foto que já tinha.
      const fotoFinal = req.file ? '/uploads/' + req.file.filename : doacao.foto;
      const fotoAntiga = req.file ? doacao.foto : null;

      db.run(
        `UPDATE doacoes
         SET livro = ?, categoria = ?, quantidade = ?, descricao = ?, foto = ?
         WHERE id = ?`,
        [livro, categoria, quantidade, descricao || null, fotoFinal, req.params.id],
        (err2) => {

          if (err2) {
            console.log(err2);
            return res.redirect('/doar/' + req.params.id + '/editar?erro=1');
          }

          // Apaga o arquivo da foto antiga do disco, já que foi substituída
          if (fotoAntiga) {
            fs.unlink(path.join(__dirname, '../public', fotoAntiga), () => {});
          }

          res.redirect('/perfil?aba=doados&sucesso=editada');
        }
      );
    }
  );

});

// ===================== CANCELAR DOAÇÃO (só enquanto está "pendente") =====================
router.post('/doar/:id/cancelar', autenticado, (req, res) => {

  db.get(
    'SELECT * FROM doacoes WHERE id = ?',
    [req.params.id],
    (err, doacao) => {

      if (err || !doacao) {
        return res.redirect('/perfil?aba=doados&erro=nao_encontrada');
      }

      const dono = doacao.usuario_id
        ? doacao.usuario_id === req.session.usuario_id
        : doacao.email === req.session.email;

      if (!dono || doacao.status !== 'pendente') {
        return res.redirect('/perfil?aba=doados&erro=sem_permissao');
      }

      db.run('DELETE FROM doacoes WHERE id = ?', [req.params.id], (err2) => {

        if (err2) {
          console.log(err2);
          return res.redirect('/perfil?aba=doados&erro=1');
        }

        if (doacao.foto) {
          fs.unlink(path.join(__dirname, '../public', doacao.foto), () => {});
        }

        res.redirect('/perfil?aba=doados&sucesso=cancelada');
      });
    }
  );

});

module.exports = router;