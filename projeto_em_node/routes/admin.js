const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { paraDataUTC } = require("../database/data-utils");
const { statusInfo, PROXIMO_STATUS, podeCancelar } = require("../database/status-utils");

// Só quem tem a conta marcada como admin (usuarios.admin = 1) acessa o painel
function ehAdmin(req, res, next) {
    if (req.session && req.session.usuario_id && req.session.usuario_admin) {
        return next();
    }
    res.redirect("/home");
}

// ===================== PAINEL: LISTA DE PEDIDOS =====================
router.get("/admin/pedidos", ehAdmin, (req, res) => {

    db.all("SELECT * FROM solicitacoes ORDER BY data_envio DESC", [], (err, pedidos) => {

        if (err) console.log(err);

        const lista = (pedidos || []).map((p) => {
            const status = p.status || "recebida";
            const dataEnvio = paraDataUTC(p.data_envio);
            const dataAtualizacao = paraDataUTC(p.data_atualizacao);
            return {
                ...p,
                statusInfo: statusInfo(status),
                proxima: PROXIMO_STATUS[status] || null,
                cancelavel: podeCancelar(status),
                dataEnvioFormatada: dataEnvio
                    ? dataEnvio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
                    : "—",
                dataAtualizacaoFormatada: dataAtualizacao
                    ? dataAtualizacao.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }) + " às " +
                      dataAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
                    : "—"
            };
        });

        res.render("admin-pedidos", {
            usuario: req.session.usuario_nome || null,
            usuarioTipo: req.session.usuario_tipo || null,
            pedidos: lista,
            pagina: "admin-pedidos",
            erro: req.query.erro || null,
            sucesso: req.query.sucesso || null
        });
    });

});

// ===================== PAINEL: AVANÇAR STATUS =====================
router.post("/admin/pedidos/:id/avancar", ehAdmin, (req, res) => {

    db.get("SELECT * FROM solicitacoes WHERE id = ?", [req.params.id], (err, pedido) => {

        if (err || !pedido) {
            return res.redirect("/admin/pedidos?erro=nao_encontrada");
        }

        const passo = PROXIMO_STATUS[pedido.status || "recebida"];

        if (!passo) {
            return res.redirect("/admin/pedidos?erro=sem_avanco");
        }

        db.run(
            `UPDATE solicitacoes SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [passo.proximo, req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/admin/pedidos?erro=sistema");
                }
                res.redirect("/admin/pedidos?sucesso=1");
            }
        );
    });

});

// ===================== PAINEL: CANCELAR PEDIDO =====================
router.post("/admin/pedidos/:id/cancelar", ehAdmin, (req, res) => {

    db.get("SELECT * FROM solicitacoes WHERE id = ?", [req.params.id], (err, pedido) => {

        if (err || !pedido) {
            return res.redirect("/admin/pedidos?erro=nao_encontrada");
        }

        if (!podeCancelar(pedido.status || "recebida")) {
            return res.redirect("/admin/pedidos?erro=nao_cancelavel");
        }

        db.run(
            `UPDATE solicitacoes SET status = 'cancelada', data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/admin/pedidos?erro=sistema");
                }
                res.redirect("/admin/pedidos?sucesso=1");
            }
        );
    });

});

module.exports = router;
