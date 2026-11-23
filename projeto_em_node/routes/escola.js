const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../database/db");
const { paraDataUTC } = require("../database/data-utils");
const { statusInfo, podeCancelar } = require("../database/status-utils");
const { AVATARES_ESCOLA, ETAPAS_ESCOLA } = require("../database/perfil-config");

// Fotos dos relatos ficam em public/uploads (mesma pasta das fotos de doação)
const EXTENSOES = { "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, "../public/uploads")),
        filename: (req, file, cb) => cb(null, "relato-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + (EXTENSOES[file.mimetype] || ".jpg"))
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, igual às fotos de doação
    fileFilter: (req, file, cb) => cb(null, Boolean(EXTENSOES[file.mimetype]))
});

const FRASE_MAX = 280;

// A mesma URL (?erro=) serve pro relato e pro editar perfil/pedidos; estes são os do relato
const ERROS_RELATO = ["foto", "livro", "frase", "autorizacao", "relato_sistema"];

// Pequeno helper pra usar o sqlite3 (callbacks) com async/await
const all = (sql, params = []) => new Promise((ok, falha) => db.all(sql, params, (e, r) => (e ? falha(e) : ok(r))));
const get = (sql, params = []) => new Promise((ok, falha) => db.get(sql, params, (e, r) => (e ? falha(e) : ok(r))));

const executar = (sql, params = []) => new Promise((ok, falha) => db.run(sql, params, function (e) { return e ? falha(e) : ok(this); }));

// Apaga o arquivo de um relato (só se estiver dentro de /uploads)
const apagarFoto = (foto) => {
    if (!foto || !foto.startsWith("/uploads/")) return;
    fs.unlink(path.join(__dirname, "../public", foto), () => {});
};

const formatarData = (d) => {
    const data = paraDataUTC(d);
    return data
        ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
        : "—";
};

// ===================== LISTA PÚBLICA DE ESCOLAS (/escolas) =====================
// Toda escola cadastrada aparece aqui pra qualquer visitante: é assim que os doadores
// (e as outras escolas) descobrem quem está no DiscoverBook e quer receber livros.
router.get("/escolas", async (req, res) => {
    try {
        const escolas = await all(
            `SELECT u.id, COALESCE(u.username, u.nome) AS nome, u.cidade, u.etapas, u.avatar, u.necessidades, u.alunos,
                    (SELECT COALESCE(SUM(s.quantidade), 0) FROM solicitacoes s WHERE s.usuario_id = u.id AND s.status = 'entregue') AS recebidos,
                    (SELECT COUNT(*) FROM relatos r WHERE r.escola_id = u.id) AS relatos
             FROM usuarios u WHERE u.tipo = 'escola'
             ORDER BY LOWER(COALESCE(u.username, u.nome))`
        );
        res.render("escolas", {
            pagina: "escolas",
            escolas: escolas.map((e) => ({
                ...e,
                foto: e.avatar ? "/img/avatars/" + e.avatar : "/img/perfil-padrao.jpg",
                etapasLista: (e.etapas || "").split(",").filter(Boolean)
            })),
            usuarioTipoAtual: req.session?.usuario_tipo || null
        });
    } catch (err) {
        console.log(err);
        res.status(500).send("Erro ao carregar as escolas.");
    }
});

// ===================== PÁGINA PÚBLICA DA ESCOLA =====================
// Aberta pra qualquer visitante (não exige login). Só expõe nome de perfil,
// avatar, descrição e dados de livros — nunca e-mail, telefone ou senha.
router.get("/escola/:id", async (req, res) => {
    try {
        const escola = await get(
            "SELECT id, nome, username, bio, avatar, data_criacao, cidade, etapas, alunos, necessidades, instagram FROM usuarios WHERE id = ? AND tipo = 'escola'",
            [req.params.id]
        );
        if (!escola) return res.status(404).send("Escola não encontrada.");

        // O que a escola já recebeu: pedidos entregues + repasses aprovados de outras escolas
        const ehDona = req.session?.usuario_id === escola.id;

        const [entregues, repassesRecebidos, disponiveis, doado, relatosBrutos, paraRelatar, ofertasPendentes] = await Promise.all([
            all(`SELECT livro, quantidade, COALESCE(data_atualizacao, data_envio) AS data
                 FROM solicitacoes WHERE usuario_id = ? AND status = 'entregue'`, [escola.id]),
            all(`SELECT r.livro, r.quantidade, COALESCE(r.data_atualizacao, r.data_criacao) AS data,
                        u.id AS origemId, COALESCE(u.username, u.nome) AS origemNome
                 FROM repasses r JOIN usuarios u ON u.id = r.escola_origem_id
                 WHERE r.escola_destino_id = ? AND r.status = 'aprovado'`, [escola.id]),
            all(`SELECT id, livro, categoria, quantidade, descricao, data_criacao
                 FROM repasses WHERE escola_origem_id = ? AND status = 'disponivel'
                 ORDER BY data_criacao DESC`, [escola.id]),
            get(`SELECT COALESCE(SUM(quantidade), 0) AS total
                 FROM repasses WHERE escola_origem_id = ? AND status = 'aprovado'`, [escola.id]),
            // Mural: relatos publicados pela escola. "doadores" conta quantas pessoas
            // doaram esse título antes do relato (só o número — nunca o nome, por privacidade).
            all(`SELECT r.id, r.livro, r.foto, r.frase, r.data_criacao,
                        (SELECT COUNT(DISTINCT COALESCE(d.usuario_id, d.email)) FROM doacoes d
                          WHERE LOWER(TRIM(d.livro)) = LOWER(TRIM(r.livro))
                            AND d.status = 'disponivel' AND d.data_envio <= r.data_criacao
                            AND (d.escola_destino_id IS NULL OR d.escola_destino_id = r.escola_id)) AS doadores
                 FROM relatos r WHERE r.escola_id = ? ORDER BY r.data_criacao DESC, r.id DESC`, [escola.id]),
            // Só a dona vê o formulário, e só pode relatar livros que já foram entregues a ela
            ehDona
                ? all(`SELECT id, livro, quantidade FROM solicitacoes
                       WHERE usuario_id = ? AND status = 'entregue'
                       ORDER BY COALESCE(data_atualizacao, data_envio) DESC, id DESC`, [escola.id])
                : Promise.resolve([]),
            // Doações que outras escolas escolheram mandar pra cá e ainda esperam resposta
            ehDona
                ? get("SELECT COUNT(*) AS total FROM repasses WHERE escola_destino_id = ? AND status = 'oferecido'", [escola.id])
                : Promise.resolve({ total: 0 })
        ]);

        // Só a dona da página vê: pedidos (com status/cancelar), ranking e o formulário de editar
        let itens = [], ranking = [], totalRepassado = 0;
        if (ehDona) {
            const [pedidos, escolasRank] = await Promise.all([
                all("SELECT * FROM solicitacoes WHERE usuario_id = ? ORDER BY data_envio DESC", [escola.id]),
                all(`SELECT u.id, u.username, u.nome, u.avatar,
                            COALESCE(SUM(r.quantidade), 0) AS totalRepassado
                     FROM usuarios u
                     LEFT JOIN repasses r ON r.escola_origem_id = u.id AND r.status = 'aprovado'
                     WHERE u.tipo = 'escola' GROUP BY u.id`)
            ]);
            itens = pedidos.map((item) => {
                const status = item.status || "recebida";
                return { ...item, statusInfo: statusInfo(status), cancelavel: podeCancelar(status) };
            });
            ranking = escolasRank
                .map((e) => ({
                    id: e.id,
                    nome: e.username || e.nome,
                    foto: e.avatar ? "/img/avatars/" + e.avatar : "/img/perfil-padrao.jpg",
                    totalLivros: e.totalRepassado
                }))
                .sort((a, b) => b.totalLivros - a.totalLivros);
            const eu = ranking.find((e) => e.id === escola.id);
            totalRepassado = eu ? eu.totalLivros : 0;
        }

        const erroQuery = req.query.erro || null;
        const erroEhDoRelato = ERROS_RELATO.includes(erroQuery);

        const relatos = relatosBrutos.map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) }));

        const recebidos = [
            ...entregues.map((i) => ({ ...i, origem: "Acervo DiscoverBook" })),
            ...repassesRecebidos.map((i) => ({ ...i, origem: "Repasse de " + i.origemNome, origemId: i.origemId }))
        ]
            .sort((a, b) => (paraDataUTC(b.data) || 0) - (paraDataUTC(a.data) || 0))
            .map((i) => ({ ...i, dataFormatada: formatarData(i.data) }));

        res.render("escola", {
            pagina: "escola",
            escola,
            nomeExibido: escola.username || escola.nome,
            fotoEscola: escola.avatar ? "/img/avatars/" + escola.avatar : "/img/perfil-padrao.jpg",
            desde: formatarData(escola.data_criacao),
            recebidos,
            totalRecebido: recebidos.reduce((s, i) => s + (i.quantidade || 0), 0),
            totalDoado: doado.total,
            disponiveis: disponiveis.map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) })),
            relatos,
            paraRelatar,
            fraseMax: FRASE_MAX,
            podeExcluirRelato: ehDona || Boolean(req.session?.usuario_admin),
            sucesso: req.query.sucesso || null,
            erro: erroEhDoRelato ? erroQuery : null,
            // Editar perfil / pedidos (só aparecem pra dona)
            editar: ehDona && req.query.editar === "1",
            erroPerfil: erroEhDoRelato ? null : erroQuery,
            sugestoesPerfil: req.query.sugestoes ? req.query.sugestoes.split(",") : [],
            avatares: AVATARES_ESCOLA,
            etapasDisponiveis: ETAPAS_ESCOLA,
            itens,
            ranking,
            totalRepassado,
            ehDona,
            ofertasPendentes: ofertasPendentes ? ofertasPendentes.total : 0,
            podePedir: req.session?.usuario_tipo === "escola" && req.session.usuario_id !== escola.id
        });
    } catch (err) {
        console.log(err);
        res.status(500).send("Erro ao carregar a página da escola.");
    }
});

// ===================== PUBLICAR RELATO (escola mostra o livro em uso) =====================
router.post("/escola/relato", (req, res, next) => {
    if (!req.session?.usuario_id || req.session.usuario_tipo !== "escola") return res.redirect("/login");
    upload.single("foto")(req, res, (erroUpload) => {
        // Arquivo grande demais / tipo inválido caem aqui ou ficam sem req.file
        if (erroUpload) req.erroFoto = true;
        next();
    });
}, async (req, res) => {
    const escolaId = req.session.usuario_id;
    const voltar = (qs) => res.redirect("/escola/" + escolaId + "?" + qs + "#publicar");
    const limparFoto = () => { if (req.file) apagarFoto("/uploads/" + req.file.filename); };

    try {
        const { solicitacao_id, frase, autorizacao } = req.body;
        const texto = (frase || "").trim();

        if (req.erroFoto || !req.file) { limparFoto(); return voltar("erro=foto"); }
        if (!solicitacao_id) { limparFoto(); return voltar("erro=livro"); }
        if (texto.length < 3 || texto.length > FRASE_MAX) { limparFoto(); return voltar("erro=frase"); }
        if (autorizacao !== "on") { limparFoto(); return voltar("erro=autorizacao"); }

        // O pedido precisa ser desta escola e já estar "entregue"
        const pedido = await get(
            "SELECT id, livro FROM solicitacoes WHERE id = ? AND usuario_id = ? AND status = 'entregue'",
            [solicitacao_id, escolaId]
        );
        if (!pedido) { limparFoto(); return voltar("erro=livro"); }

        await executar(
            "INSERT INTO relatos (escola_id, solicitacao_id, livro, foto, frase) VALUES (?, ?, ?, ?, ?)",
            [escolaId, pedido.id, pedido.livro, "/uploads/" + req.file.filename, texto]
        );

        res.redirect("/escola/" + escolaId + "?sucesso=relato#mural");
    } catch (err) {
        console.log(err);
        limparFoto();
        voltar("erro=relato_sistema");
    }
});

// ===================== EXCLUIR RELATO (a própria escola ou a equipe) =====================
router.post("/escola/relato/:id/excluir", async (req, res) => {
    if (!req.session?.usuario_id) return res.redirect("/login");

    try {
        const relato = await get("SELECT id, escola_id, foto FROM relatos WHERE id = ?", [req.params.id]);
        if (!relato) return res.redirect("/home");

        const ehDona = relato.escola_id === req.session.usuario_id;
        if (!ehDona && !req.session.usuario_admin) return res.redirect("/escola/" + relato.escola_id);

        await executar("DELETE FROM relatos WHERE id = ?", [relato.id]);
        apagarFoto(relato.foto);
        res.redirect("/escola/" + relato.escola_id + "?sucesso=relato_excluido#mural");
    } catch (err) {
        console.log(err);
        res.redirect("/home");
    }
});

module.exports = router;
