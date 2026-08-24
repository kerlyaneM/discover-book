const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../database/db");
const { paraDataUTC } = require("../database/data-utils");

function autenticado(req, res, next) {
    if (req.session && req.session.usuario_id) {
        return next();
    }
    res.redirect("/login");
}

// ===================== VER CONFIGURAÇÕES =====================
router.get("/configuracoes", autenticado, (req, res) => {

    db.get(
        "SELECT * FROM usuarios WHERE id = ?",
        [req.session.usuario_id],
        (err, usuario) => {

            if (err || !usuario) {
                return res.redirect("/home");
            }

            let dataFormatada = "—";
            const dCriacao = paraDataUTC(usuario.data_criacao);
            if (dCriacao) {
                dataFormatada = dCriacao.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
            }

            res.render("configuracoes", {
                usuario,
                dataFormatada,
                aba: req.query.aba || "conta",
                erroSenha: req.query.erro_senha || null,
                sucessoSenha: req.query.sucesso_senha === "1",
                erroConta: req.query.erro_conta || null
            });
        }
    );

});

// ===================== ALTERAR SENHA =====================
router.post("/configuracoes/senha", autenticado, (req, res) => {

    const { senha_atual, nova_senha, confirmar_senha } = req.body;

    if (!senha_atual || !nova_senha || !confirmar_senha) {
        return res.redirect("/configuracoes?aba=senha&erro_senha=campos");
    }

    if (nova_senha !== confirmar_senha) {
        return res.redirect("/configuracoes?aba=senha&erro_senha=confirmacao");
    }

    if (nova_senha.length < 6) {
        return res.redirect("/configuracoes?aba=senha&erro_senha=tamanho");
    }

    db.get(
        "SELECT senha FROM usuarios WHERE id = ?",
        [req.session.usuario_id],
        async (err, usuario) => {

            if (err || !usuario) {
                return res.redirect("/configuracoes?aba=senha&erro_senha=sistema");
            }

            const senhaCorreta = await bcrypt.compare(senha_atual, usuario.senha);
            if (!senhaCorreta) {
                return res.redirect("/configuracoes?aba=senha&erro_senha=senha_atual");
            }

            const hash = await bcrypt.hash(nova_senha, 10);
            db.run(
                "UPDATE usuarios SET senha = ? WHERE id = ?",
                [hash, req.session.usuario_id],
                (err2) => {
                    if (err2) {
                        return res.redirect("/configuracoes?aba=senha&erro_senha=sistema");
                    }
                    res.redirect("/configuracoes?aba=senha&sucesso_senha=1");
                }
            );
        }
    );

});

// ===================== EXCLUIR CONTA =====================
router.post("/configuracoes/excluir-conta", autenticado, (req, res) => {

    const { senha } = req.body;

    if (!senha) {
        return res.redirect("/configuracoes?aba=privacidade&erro_conta=senha");
    }

    db.get(
        "SELECT senha FROM usuarios WHERE id = ?",
        [req.session.usuario_id],
        async (err, usuario) => {

            if (err || !usuario) {
                return res.redirect("/configuracoes?aba=privacidade&erro_conta=sistema");
            }

            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (!senhaCorreta) {
                return res.redirect("/configuracoes?aba=privacidade&erro_conta=senha_incorreta");
            }

            db.run(
                "DELETE FROM usuarios WHERE id = ?",
                [req.session.usuario_id],
                (err2) => {
                    if (err2) {
                        return res.redirect("/configuracoes?aba=privacidade&erro_conta=sistema");
                    }
                    req.session.destroy(() => res.redirect("/login"));
                }
            );
        }
    );

});

module.exports = router;
