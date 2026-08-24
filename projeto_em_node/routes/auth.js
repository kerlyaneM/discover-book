const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');

function autenticado(req, res, next) {
  if (req.session && req.session.email) return next();
  res.redirect('/login');
}



// Páginas estáticas
router.get('/', (req, res) => res.redirect('/home'));
router.get('/home', (req, res) =>
    res.render('home', {
        usuario: req.session.usuario_nome || null,
        pagina: "home"
    })
);
router.get('/sobre', (req, res) =>
    res.render('sobre', {
        usuario: req.session.usuario_nome || null,
        pagina: "sobre"
    })
);
router.get('/infantil', (req, res) =>
    res.render('infantil', {
        usuario: req.session.usuario_nome || null,
        pagina: "infantil"
    })
);

router.get('/idade3-5', (req, res) =>
    res.render('idade3-5', {
        usuario: req.session.usuario_nome || null,
        pagina: "fundamental"
    })
);

router.get('/idade6-10', (req, res) =>
    res.render('idade6-10', {
        usuario: req.session.usuario_nome || null,
        pagina: "medio"
    })
);

router.get('/leitura', (req, res) =>
    res.render('leitura', {
        usuario: req.session.usuario_nome || null,
        pagina: "leitura"
    })
);

router.get('/livro', (req, res) => res.render('livro', { usuario: req.session.usuario_nome || null }));

// Login
router.get('/login', (req, res) => {
  res.render('login', {
    erro: req.query.erro || null,
    sucesso: req.query.sucesso || null,
    sucesso_redefinir: req.query.sucesso_redefinir || null
  });
});



router.post('/login', (req, res) => {
  const { email_id, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)', [(email_id || '').trim()], async (err, usuario) => {
    if (err || !usuario) return res.redirect('/login?erro=1');

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (senhaCorreta) {
     req.session.email = usuario.email;
req.session.usuario_id = usuario.id;
req.session.usuario_nome = usuario.username || usuario.nome;
req.session.usuario_foto = usuario.avatar ? "/img/avatars/" + usuario.avatar : "/img/perfil-padrao.jpg";
req.session.usuario_tipo = usuario.tipo;
req.session.usuario_admin = usuario.admin === 1;
      res.redirect('/home');
    } else {
      res.redirect('/login?erro=1');
    }
  });
});

// Cadastro
router.get('/cadastro', (req, res) => {
  res.render('cadastro', { erro: req.query.erro || null });
});

// Senha precisa de pelo menos 8 caracteres, com letra e número. Validado
// aqui no servidor porque o "minlength" do HTML é só uma ajuda visual e
// não pode ser a única barreira.
function senhaFraca(senha) {
  if (!senha || senha.length < 8) return true;
  const temLetra = /[A-Za-z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  return !(temLetra && temNumero);
}

router.post('/cadastro', async (req, res) => {
  const { nome, email, senha, confirmar_senha, tipo } = req.body;

  const nomeLimpo = (nome || '').trim();
  const emailLimpo = (email || '').trim().toLowerCase();

  if (!nomeLimpo || !emailLimpo || !senha) {
    return res.redirect('/cadastro?erro=dados');
  }

  if (senhaFraca(senha)) {
    return res.redirect('/cadastro?erro=senha_fraca');
  }

  if (senha !== confirmar_senha) {
    return res.redirect('/cadastro?erro=senha_diferente');
  }

  // Checagem case-insensitive: "nome@gmail.com" e "Nome@Gmail.com" contam
  // como o mesmo e-mail (o UNIQUE do banco sozinho não pega isso).
  db.get('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)', [emailLimpo], async (err, existe) => {
    if (err) return res.redirect('/cadastro?erro=sistema');
    if (existe) return res.redirect('/cadastro?erro=email_existe');

    const hash = await bcrypt.hash(senha, 10);
    db.run(
      'INSERT INTO usuarios (nome, email, senha, tipo, data_criacao) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [nomeLimpo, emailLimpo, hash, tipo || 'doador'],
      function (err) {
        if (err) return res.redirect('/cadastro?erro=sistema');

        // Loga a pessoa automaticamente — sem isso ela teria que digitar
        // email e senha de novo logo depois de ter acabado de cadastrar.
        req.session.email = emailLimpo;
        req.session.usuario_id = this.lastID;
        req.session.usuario_nome = nomeLimpo;
        req.session.usuario_foto = "/img/perfil-padrao.jpg";
        req.session.usuario_tipo = tipo || 'doador';
        req.session.usuario_admin = false;

        res.redirect('/home');
      }
    );
  });
});

// Esqueci a senha
router.get('/esqueci', (req, res) => {
  res.render('esqueci', { erro: req.query.erro || null });
});

router.post('/redefinir', async (req, res) => {
  const { email, nome, nova_senha } = req.body;

  const emailLimpo = (email || '').trim().toLowerCase();
  const nomeLimpo = (nome || '').trim();

  if (senhaFraca(nova_senha)) {
    return res.redirect('/esqueci?erro=senha_fraca');
  }

  db.get('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND LOWER(nome) = LOWER(?)', [emailLimpo, nomeLimpo], async (err, usuario) => {
    if (err) return res.redirect('/esqueci?erro=sistema');
    if (!usuario) return res.redirect('/esqueci?erro=dados_invalidos');

    const hash = await bcrypt.hash(nova_senha, 10);
    db.run('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, usuario.id], function (err) {
      if (err) return res.redirect('/esqueci?erro=sistema');
      if (this.changes > 0) res.redirect('/login?sucesso_redefinir=1');
      else res.redirect('/esqueci?erro=senha_igual');
    });
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;