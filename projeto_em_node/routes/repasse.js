const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { paraDataUTC } = require("../database/data-utils");

// Esse fluxo é só entre escolas: uma escola cadastra um livro excedente
// (duplicado/que não usa mais) e outra escola solicita. É separado de
// propósito do fluxo doador -> escola (/doar, /acervo, /carrinho).
function autenticadoEscola(req, res, next) {
    if (req.session && req.session.usuario_id && req.session.usuario_tipo === "escola") {
        return next();
    }
    res.redirect("/login");
}

// ===================== PÁGINA DE REPASSE =====================
const all = (sql, params = []) => new Promise((ok, falha) => db.all(sql, params, (e, r) => (e ? falha(e) : ok(r))));
const get = (sql, params = []) => new Promise((ok, falha) => db.get(sql, params, (e, r) => (e ? falha(e) : ok(r))));

const formatarData = (d) => {
    const data = paraDataUTC(d);
    return data
        ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
        : "—";
};

router.get("/repasse", autenticadoEscola, async (req, res) => {

    const escolaId = req.session.usuario_id;

    try {
        const [meusRepasses, disponiveis, ofertasRecebidas, escolas] = await Promise.all([
            // Tudo que a própria escola cadastrou pra doar (qualquer status)
            all(
                `SELECT r.*, COALESCE(u.username, u.nome) AS escolaDestinoNome
                 FROM repasses r
                 LEFT JOIN usuarios u ON u.id = r.escola_destino_id
                 WHERE r.escola_origem_id = ?
                 ORDER BY r.data_criacao DESC`,
                [escolaId]
            ),
            // Livros avulsos (modelo antigo, sem escola escolhida) de OUTRAS escolas
            all(
                `SELECT r.*, COALESCE(u.username, u.nome) AS escolaOrigemNome
                 FROM repasses r
                 JOIN usuarios u ON u.id = r.escola_origem_id
                 WHERE r.status = 'disponivel' AND r.escola_origem_id != ?
                 ORDER BY r.data_criacao DESC`,
                [escolaId]
            ),
            // Doações que OUTRAS escolas escolheram mandar pra esta escola
            all(
                `SELECT r.*, COALESCE(u.username, u.nome) AS escolaOrigemNome, u.avatar AS escolaOrigemAvatar
                 FROM repasses r
                 JOIN usuarios u ON u.id = r.escola_origem_id
                 WHERE r.escola_destino_id = ? AND r.status IN ('oferecido', 'aprovado', 'recusado')
                 ORDER BY CASE r.status WHEN 'oferecido' THEN 0 ELSE 1 END, r.data_criacao DESC`,
                [escolaId]
            ),
            // Escolas cadastradas (todas públicas) pra escolher quem vai receber
            all(
                `SELECT id, COALESCE(username, nome) AS nome, cidade, etapas, avatar, necessidades
                 FROM usuarios
                 WHERE tipo = 'escola' AND id != ?
                 ORDER BY LOWER(COALESCE(username, nome))`,
                [escolaId]
            )
        ]);

        res.render("repasse", {
            usuario: req.session.usuario_nome || null,
            pagina: "repasse",
            sucesso: req.query.sucesso || null,
            erro: req.query.erro || null,
            escolaSelecionada: req.query.para || null,
            meusRepasses: meusRepasses.map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) })),
            disponiveis: disponiveis.map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) })),
            ofertasRecebidas: ofertasRecebidas.map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) })),
            escolas
        });
    } catch (err) {
        console.log(err);
        res.status(500).send("Erro ao carregar a página de doação entre escolas.");
    }

});

// ===================== DOAR LIVRO PARA UMA ESCOLA ESCOLHIDA =====================
router.post("/repasse", autenticadoEscola, (req, res) => {

    const { livro, categoria, quantidade, descricao, escola_destino_id } = req.body;
    const qtd = parseInt(quantidade, 10);

    if (!livro || !livro.trim() || !categoria || !(qtd > 0)) {
        return res.redirect("/repasse?erro=dados");
    }

    if (!escola_destino_id) {
        return res.redirect("/repasse?erro=escola");
    }

    // Nunca confia só no formulário: o destino precisa ser outra escola cadastrada
    db.get(
        "SELECT id FROM usuarios WHERE id = ? AND tipo = 'escola' AND id != ?",
        [escola_destino_id, req.session.usuario_id],
        (errEscola, escola) => {

            if (errEscola || !escola) {
                return res.redirect("/repasse?erro=escola");
            }

            db.run(
                `INSERT INTO repasses (escola_origem_id, escola_destino_id, livro, categoria, quantidade, descricao, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'oferecido')`,
                [req.session.usuario_id, escola.id, livro.trim(), categoria, qtd, (descricao || "").trim() || null],
                (err) => {
                    if (err) {
                        console.log(err);
                        return res.redirect("/repasse?erro=sistema");
                    }
                    res.redirect("/repasse?sucesso=enviado");
                }
            );
        }
    );

});

// ===================== ACEITAR / RECUSAR UMA DOAÇÃO RECEBIDA (a escola escolhida responde) =====================
function responderOferta(novoStatus, sucesso) {
    return (req, res) => {
        db.get("SELECT * FROM repasses WHERE id = ?", [req.params.id], (err, repasse) => {

            if (err || !repasse) {
                return res.redirect("/repasse?erro=nao_encontrado");
            }

            if (repasse.escola_destino_id !== req.session.usuario_id || repasse.status !== "oferecido") {
                return res.redirect("/repasse?erro=sem_permissao");
            }

            db.run(
                "UPDATE repasses SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?",
                [novoStatus, req.params.id],
                (err2) => {
                    if (err2) {
                        console.log(err2);
                        return res.redirect("/repasse?erro=sistema");
                    }
                    res.redirect("/repasse?sucesso=" + sucesso + "#recebidas");
                }
            );
        });
    };
}

router.post("/repasse/:id/aceitar", autenticadoEscola, responderOferta("aprovado", "aceita"));
router.post("/repasse/:id/rejeitar", autenticadoEscola, responderOferta("recusado", "rejeitada"));

// ===================== SOLICITAR REPASSE (outra escola pede o livro) =====================
router.post("/repasse/:id/solicitar", autenticadoEscola, (req, res) => {

    db.get("SELECT * FROM repasses WHERE id = ?", [req.params.id], (err, repasse) => {

        if (err || !repasse) {
            return res.redirect("/repasse?erro=nao_encontrado");
        }

        if (repasse.escola_origem_id === req.session.usuario_id) {
            return res.redirect("/repasse?erro=proprio_livro");
        }

        if (repasse.status !== "disponivel") {
            return res.redirect("/repasse?erro=indisponivel");
        }

        db.run(
            `UPDATE repasses SET status = 'solicitado', escola_destino_id = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.session.usuario_id, req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/repasse?erro=sistema");
                }
                res.redirect("/repasse?sucesso=solicitado");
            }
        );
    });

});

// ===================== APROVAR REPASSE (a escola de origem aprova) =====================
router.post("/repasse/:id/aprovar", autenticadoEscola, (req, res) => {

    db.get("SELECT * FROM repasses WHERE id = ?", [req.params.id], (err, repasse) => {

        if (err || !repasse) {
            return res.redirect("/repasse?erro=nao_encontrado");
        }

        if (repasse.escola_origem_id !== req.session.usuario_id || repasse.status !== "solicitado") {
            return res.redirect("/repasse?erro=sem_permissao");
        }

        // Vira "aprovado": é esse status que conta pro ranking "Escolas parceiras"
        db.run(
            `UPDATE repasses SET status = 'aprovado', data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/repasse?erro=sistema");
                }
                res.redirect("/repasse?sucesso=aprovado");
            }
        );
    });

});

// ===================== RECUSAR REPASSE (a escola de origem recusa o pedido) =====================
router.post("/repasse/:id/recusar", autenticadoEscola, (req, res) => {

    db.get("SELECT * FROM repasses WHERE id = ?", [req.params.id], (err, repasse) => {

        if (err || !repasse) {
            return res.redirect("/repasse?erro=nao_encontrado");
        }

        if (repasse.escola_origem_id !== req.session.usuario_id || repasse.status !== "solicitado") {
            return res.redirect("/repasse?erro=sem_permissao");
        }

        // Volta a ficar disponível pra outra escola solicitar
        db.run(
            `UPDATE repasses SET status = 'disponivel', escola_destino_id = NULL, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/repasse?erro=sistema");
                }
                res.redirect("/repasse?sucesso=recusado");
            }
        );
    });

});

// ===================== CANCELAR LIVRO EXCEDENTE (só enquanto "disponivel") =====================
router.post("/repasse/:id/cancelar", autenticadoEscola, (req, res) => {

    db.get("SELECT * FROM repasses WHERE id = ?", [req.params.id], (err, repasse) => {

        if (err || !repasse) {
            return res.redirect("/repasse?erro=nao_encontrado");
        }

        if (repasse.escola_origem_id !== req.session.usuario_id || !["disponivel", "oferecido"].includes(repasse.status)) {
            return res.redirect("/repasse?erro=sem_permissao");
        }

        db.run(
            `UPDATE repasses SET status = 'cancelado', data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/repasse?erro=sistema");
                }
                res.redirect("/repasse?sucesso=cancelado");
            }
        );
    });

});

module.exports = router;
