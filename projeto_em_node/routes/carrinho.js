const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { podeCancelar } = require("../database/status-utils");

// Ponto de retirada fixo (por enquanto só o IFMA — se isso mudar no futuro
// esses dados voltam a ficar editáveis pela equipe).
const RETIRADA = {
    local: "IFMA – Campus São José de Ribamar",
    horario: "Segunda a sexta, das 14h às 17h"
};

// Número de WhatsApp da equipe pra onde o botão de confirmação do pedido aponta
const WHATSAPP_EQUIPE = "5599999999999";

// Garante que o carrinho existe na sessão da pessoa
function getCarrinho(req) {
    if (!req.session.carrinho) req.session.carrinho = [];
    return req.session.carrinho;
}

function totalDeItens(carrinho) {
    return carrinho.reduce((soma, item) => soma + item.quantidade, 0);
}

// ===================== DADOS DO CARRINHO (usado pela gaveta em todas as páginas) =====================
router.get("/carrinho/dados", (req, res) => {
    const carrinho = getCarrinho(req);
    res.json({ ok: true, itens: carrinho, totalItens: totalDeItens(carrinho) });
});

// ===================== ADICIONAR ITEM =====================
router.post("/carrinho/adicionar", (req, res) => {
    const { nome, imagem, categoria, faixa } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ ok: false, erro: "Livro inválido." });
    }

    const carrinho = getCarrinho(req);
    const chave = (nome + "|" + (categoria || "")).toLowerCase().trim();
    const existente = carrinho.find((item) => item.chave === chave);

    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinho.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            chave,
            nome: nome.trim(),
            imagem: imagem || "/img/perfil-padrao.jpg",
            categoria: categoria || "",
            faixa: faixa || "",
            quantidade: 1
        });
    }

    res.json({ ok: true, itens: carrinho, totalItens: totalDeItens(carrinho) });
});

// ===================== ATUALIZAR QUANTIDADE =====================
router.post("/carrinho/atualizar", (req, res) => {
    const { id, quantidade } = req.body;
    const carrinho = getCarrinho(req);
    const item = carrinho.find((i) => i.id === id);

    if (item) {
        item.quantidade = Math.max(1, Math.min(20, parseInt(quantidade, 10) || 1));
    }

    res.json({ ok: true, itens: carrinho, totalItens: totalDeItens(carrinho) });
});

// ===================== REMOVER ITEM =====================
router.post("/carrinho/remover", (req, res) => {
    const { id } = req.body;
    const carrinho = getCarrinho(req).filter((i) => i.id !== id);
    req.session.carrinho = carrinho;
    res.json({ ok: true, itens: carrinho, totalItens: totalDeItens(carrinho) });
});

// ===================== PÁGINA COMPLETA DO CARRINHO =====================
router.get("/carrinho", (req, res) => {
    const carrinho = getCarrinho(req);

    // O resumo do último pedido finalizado (guardado na sessão só na hora de
    // finalizar) alimenta o pop-up de sucesso + o link do WhatsApp. Depois de
    // ler, apaga da sessão pra não reabrir o pop-up se a página for recarregada.
    const pedidoFinalizado = req.query.sucesso === "1" ? (req.session.ultimoPedido || null) : null;
    delete req.session.ultimoPedido;

    res.render("carrinho", {
        itens: carrinho,
        totalItens: totalDeItens(carrinho),
        usuario: req.session.usuario_nome || null,
        usuarioTipo: req.session.usuario_tipo || null,
        pagina: "carrinho",
        erro: req.query.erro || null,
        sucesso: req.query.sucesso === "1",
        pedidoFinalizado,
        retirada: RETIRADA,
        whatsappEquipe: WHATSAPP_EQUIPE
    });
});

// ===================== FINALIZAR SOLICITAÇÃO =====================
router.post("/carrinho/finalizar", (req, res) => {
    const carrinho = getCarrinho(req);

    if (!req.session.usuario_id || req.session.usuario_tipo !== "escola") {
        return res.redirect("/carrinho?erro=permissao");
    }

    if (carrinho.length === 0) {
        return res.redirect("/carrinho?erro=vazio");
    }

    const { escola, responsavel, cidade, telefone, obs } = req.body;

    if (!escola || !responsavel || !cidade || !telefone || !telefone.trim()) {
        return res.redirect("/carrinho?erro=dados");
    }

    const telefoneLimpo = telefone.trim();

    const inserirItem = (item) => new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO solicitacoes
                (usuario_id, escola, responsavel, cidade, telefone, livro, quantidade, obs, status, data_atualizacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recebida', CURRENT_TIMESTAMP)`,
            [req.session.usuario_id, escola.trim(), responsavel.trim(), cidade.trim(), telefoneLimpo, item.nome, item.quantidade, obs || null],
            (err) => (err ? reject(err) : resolve())
        );
    });

    Promise.all(carrinho.map(inserirItem))
        .then(() => {
            // Guarda um resumo enxuto do pedido pra montar o pop-up de sucesso
            // e a mensagem pronta do WhatsApp na próxima vez que a página do
            // carrinho for renderizada (redirect logo abaixo).
            req.session.ultimoPedido = {
                escola: escola.trim(),
                responsavel: responsavel.trim(),
                telefone: telefoneLimpo,
                itens: carrinho.map((item) => ({ nome: item.nome, quantidade: item.quantidade }))
            };
            req.session.carrinho = [];
            res.redirect("/carrinho?sucesso=1");
        })
        .catch((err) => {
            console.log(err);
            res.redirect("/carrinho?erro=sistema");
        });
});

// ===================== CANCELAR PEDIDO (a escola cancela um item já enviado) =====================
router.post("/carrinho/pedido/:id/cancelar", (req, res) => {
    if (!req.session.usuario_id || req.session.usuario_tipo !== "escola") {
        return res.redirect("/perfil?erro=sem_permissao");
    }

    db.get("SELECT * FROM solicitacoes WHERE id = ?", [req.params.id], (err, pedido) => {

        if (err || !pedido) {
            return res.redirect("/perfil?erro=nao_encontrada");
        }

        if (pedido.usuario_id !== req.session.usuario_id) {
            return res.redirect("/perfil?erro=sem_permissao");
        }

        if (!podeCancelar(pedido.status || "recebida")) {
            return res.redirect("/perfil?erro=nao_cancelavel");
        }

        db.run(
            `UPDATE solicitacoes SET status = 'cancelada', data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id],
            (err2) => {
                if (err2) {
                    console.log(err2);
                    return res.redirect("/perfil?erro=sistema");
                }
                res.redirect("/perfil?sucesso=pedido_cancelado");
            }
        );
    });
});

module.exports = router;
