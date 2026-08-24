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
router.get("/repasse", autenticadoEscola, (req, res) => {

    const escolaId = req.session.usuario_id;

    // Livros excedentes que a própria escola cadastrou (qualquer status)
    db.all(
        `SELECT r.*, u.nome AS escolaDestinoNome, u.username AS escolaDestinoUsername
         FROM repasses r
         LEFT JOIN usuarios u ON u.id = r.escola_destino_id
         WHERE r.escola_origem_id = ?
         ORDER BY r.data_criacao DESC`,
        [escolaId],
        (err, meusRepasses) => {

            // Livros excedentes de OUTRAS escolas, ainda disponíveis pra solicitar
            db.all(
                `SELECT r.*, u.nome AS escolaOrigemNome, u.username AS escolaOrigemUsername
                 FROM repasses r
                 JOIN usuarios u ON u.id = r.escola_origem_id
                 WHERE r.status = 'disponivel' AND r.escola_origem_id != ?
                 ORDER BY r.data_criacao DESC`,
                [escolaId],
                (err2, disponiveis) => {

                    const formatarData = (d) => {
                        const data = paraDataUTC(d);
                        return data
                            ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
                            : "—";
                    };

                    res.render("repasse", {
                        usuario: req.session.usuario_nome || null,
                        pagina: "repasse",
                        sucesso: req.query.sucesso || null,
                        erro: req.query.erro || null,
                        meusRepasses: (meusRepasses || []).map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) })),
                        disponiveis: (disponiveis || []).map((r) => ({ ...r, dataFormatada: formatarData(r.data_criacao) }))
                    });
                }
            );
        }
    );

});

// ===================== CADASTRAR LIVRO EXCEDENTE =====================
router.post("/repasse", autenticadoEscola, (req, res) => {

    const { livro, categoria, quantidade, descricao } = req.body;

    if (!livro || !livro.trim() || !categoria || !quantidade) {
        return res.redirect("/repasse?erro=dados");
    }

    db.run(
        `INSERT INTO repasses (escola_origem_id, livro, categoria, quantidade, descricao, status)
         VALUES (?, ?, ?, ?, ?, 'disponivel')`,
        [req.session.usuario_id, livro.trim(), categoria, quantidade, descricao || null],
        (err) => {
            if (err) {
                console.log(err);
                return res.redirect("/repasse?erro=sistema");
            }
            res.redirect("/repasse?sucesso=cadastrado");
        }
    );

});

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

        if (repasse.escola_origem_id !== req.session.usuario_id || repasse.status !== "disponivel") {
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
