const perfilRoutes = require("./routes/perfil");
const express = require('express');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');

/* MIDDLEWARES */
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* SESSION */
app.use(session({
    secret: 'discoverbook-secret',
    resave: false,
    saveUninitialized: false
}));

/* DEIXA AS INFORMAÇÕES DISPONÍVEIS NAS VIEWS */
app.use((req, res, next) => {
    res.locals.usuario = req.session?.usuario_nome || null;
    res.locals.usuarioFoto = req.session?.usuario_foto || "/img/perfil-padrao.jpg";
    res.locals.usuarioTipo = req.session?.usuario_tipo || null;
    res.locals.usuarioAdmin = req.session?.usuario_admin || false;
    res.locals.paraDataUTC = require('./database/data-utils').paraDataUTC;
    next();
});

/* ROTAS EXTERNAS */
const authRoutes = require('./routes/auth');
const doacaoRoutes = require('./routes/doacao');
const configuracoesRoutes = require('./routes/configuracoes');
const carrinhoRoutes = require('./routes/carrinho');
const adminRoutes = require('./routes/admin');
const repasseRoutes = require('./routes/repasse');

app.use('/', authRoutes);
app.use('/', doacaoRoutes);
app.use('/', perfilRoutes);
app.use('/', configuracoesRoutes);
app.use('/', carrinhoRoutes);
app.use('/', adminRoutes);
app.use('/', repasseRoutes);

/* HOME */
app.get("/", (req, res) => {
    res.redirect("/home");
});

/* SOLICITAÇÃO */
app.get("/solicitar", (req, res) => {
    res.render("solicitar");
});

app.post("/solicitar", (req, res) => {
    const { escola, responsavel, cidade, livro, quantidade, obs } = req.body;
    const db = require("./database/db");

    db.run(
        `INSERT INTO solicitacoes
        (usuario_id, escola, responsavel, cidade, livro, quantidade, obs)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.session.usuario_id || null, escola, responsavel, cidade, livro, quantidade, obs || null],
        (err) => {
            if (err) console.log(err);
            res.send("Solicitação enviada com sucesso!");
        }
    );
});

/* SERVER */
app.listen(3000, () => {
    console.log('DiscoverBook rodando em http://localhost:3000');
});