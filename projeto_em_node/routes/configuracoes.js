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

// Versões com Promise do sqlite (a rota fica bem mais fácil de ler)
const get = (sql, params = []) => new Promise((ok, falha) => db.get(sql, params, (e, r) => (e ? falha(e) : ok(r))));
const all = (sql, params = []) => new Promise((ok, falha) => db.all(sql, params, (e, r) => (e ? falha(e) : ok(r || []))));
const run = (sql, params = []) => new Promise((ok, falha) => db.run(sql, params, function (e) { return e ? falha(e) : ok(this); }));

// Abas válidas. Os nomes antigos (senha, privacidade) continuam funcionando.
const ABAS = ["conta", "seguranca", "preferencias", "dados", "ajuda"];
const ALIAS_ABAS = { senha: "seguranca", privacidade: "dados" };

function normalizarAba(valor) {
    const aba = ALIAS_ABAS[valor] || valor;
    return ABAS.includes(aba) ? aba : "conta";
}

// Mensagens de retorno (vêm na URL como ?ok=chave ou ?erro=chave; só chaves conhecidas são aceitas)
const MENSAGENS = {
    ok: {
        senha: "Senha alterada com sucesso.",
        email: "E-mail atualizado com sucesso.",
        preferencias: "Preferências salvas."
    },
    erro: {
        campos: "Preencha todos os campos.",
        confirmacao: "A confirmação não confere com a nova senha.",
        tamanho: "A nova senha deve ter pelo menos 6 caracteres.",
        senha_igual: "A nova senha precisa ser diferente da atual.",
        senha_atual: "A senha atual está incorreta.",
        senha_incorreta: "Senha incorreta.",
        email_invalido: "Digite um e-mail válido.",
        email_igual: "Esse já é o seu e-mail atual.",
        email_em_uso: "Já existe uma conta com esse e-mail.",
        confirmacao_exclusao: "Digite EXCLUIR para confirmar.",
        sistema: "Não foi possível concluir agora. Tente novamente."
    }
};

function mensagemDaUrl(query) {
    if (query.ok && MENSAGENS.ok[query.ok]) return { tipo: "sucesso", chave: query.ok, texto: MENSAGENS.ok[query.ok] };
    if (query.erro && MENSAGENS.erro[query.erro]) return { tipo: "erro", chave: query.erro, texto: MENSAGENS.erro[query.erro] };
    return null;
}

const irPara = (res, aba, tipo, chave) => res.redirect("/configuracoes?aba=" + aba + "&" + tipo + "=" + chave);

// ===================== VER CONFIGURAÇÕES =====================
router.get("/configuracoes", autenticado, async (req, res) => {

    try {
        const usuario = await get("SELECT * FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        if (!usuario) return res.redirect("/home");

        let dataFormatada = "—";
        const dCriacao = paraDataUTC(usuario.data_criacao);
        if (dCriacao) {
            dataFormatada = dCriacao.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
        }

        // Números do resumo no topo da página
        let resumo;
        if (usuario.tipo === "escola") {
            const r = await get("SELECT COUNT(*) AS pedidos FROM solicitacoes WHERE usuario_id = ?", [usuario.id]);
            resumo = { rotulo: "pedidos enviados", valor: r ? r.pedidos : 0 };
        } else {
            const r = await get(
                "SELECT COALESCE(SUM(quantidade), 0) AS livros FROM doacoes WHERE usuario_id = ? OR email = ?",
                [usuario.id, usuario.email]
            );
            resumo = { rotulo: "livros doados", valor: r ? r.livros : 0 };
        }

        res.render("configuracoes", {
            usuario,
            dataFormatada,
            resumo,
            aba: normalizarAba(req.query.aba),
            mensagem: mensagemDaUrl(req.query)
        });
    } catch (err) {
        console.log(err);
        res.redirect("/home");
    }

});

// ===================== ALTERAR E-MAIL =====================
router.post("/configuracoes/email", autenticado, async (req, res) => {

    const novoEmail = String(req.body.email || "").trim();
    const senha = req.body.senha;

    if (!novoEmail || !senha) return irPara(res, "conta", "erro", "campos");
    if (novoEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) return irPara(res, "conta", "erro", "email_invalido");

    try {
        const usuario = await get("SELECT id, email, senha FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        if (!usuario) return irPara(res, "conta", "erro", "sistema");

        if (usuario.email.toLowerCase() === novoEmail.toLowerCase()) return irPara(res, "conta", "erro", "email_igual");

        if (!(await bcrypt.compare(senha, usuario.senha))) return irPara(res, "conta", "erro", "senha_incorreta");

        const emUso = await get("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?", [novoEmail, usuario.id]);
        if (emUso) return irPara(res, "conta", "erro", "email_em_uso");

        // Doações antigas só estão ligadas à conta pelo e-mail: amarra pelo id antes de trocar,
        // senão elas sumiriam do histórico depois da mudança.
        await run("UPDATE doacoes SET usuario_id = ? WHERE usuario_id IS NULL AND LOWER(email) = LOWER(?)", [usuario.id, usuario.email]);
        await run("UPDATE usuarios SET email = ? WHERE id = ?", [novoEmail, usuario.id]);

        req.session.email = novoEmail;
        irPara(res, "conta", "ok", "email");
    } catch (err) {
        console.log(err);
        irPara(res, "conta", "erro", "sistema");
    }

});

// ===================== ALTERAR SENHA =====================
router.post("/configuracoes/senha", autenticado, async (req, res) => {

    const { senha_atual, nova_senha, confirmar_senha } = req.body;

    if (!senha_atual || !nova_senha || !confirmar_senha) return irPara(res, "seguranca", "erro", "campos");
    if (nova_senha !== confirmar_senha) return irPara(res, "seguranca", "erro", "confirmacao");
    if (nova_senha.length < 6) return irPara(res, "seguranca", "erro", "tamanho");
    if (nova_senha === senha_atual) return irPara(res, "seguranca", "erro", "senha_igual");

    try {
        const usuario = await get("SELECT senha FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        if (!usuario) return irPara(res, "seguranca", "erro", "sistema");

        if (!(await bcrypt.compare(senha_atual, usuario.senha))) return irPara(res, "seguranca", "erro", "senha_atual");

        const hash = await bcrypt.hash(nova_senha, 10);
        await run("UPDATE usuarios SET senha = ? WHERE id = ?", [hash, req.session.usuario_id]);
        irPara(res, "seguranca", "ok", "senha");
    } catch (err) {
        console.log(err);
        irPara(res, "seguranca", "erro", "sistema");
    }

});

// ===================== PREFERÊNCIAS =====================
// Checkbox desmarcado não chega no formulário, então "ausente" = desligado.
// Cada tipo de conta só salva as preferências que existem pra ele.
router.post("/configuracoes/preferencias", autenticado, async (req, res) => {

    const marcado = (nome) => (req.body[nome] ? 1 : 0);

    try {
        if (req.session.usuario_tipo === "escola") {
            await run("UPDATE usuarios SET aceita_doacoes = ? WHERE id = ?", [marcado("aceita_doacoes"), req.session.usuario_id]);
        } else {
            await run(
                "UPDATE usuarios SET mostrar_ranking = ?, mostrar_relatos = ? WHERE id = ?",
                [marcado("mostrar_ranking"), marcado("mostrar_relatos"), req.session.usuario_id]
            );
        }
        irPara(res, "preferencias", "ok", "preferencias");
    } catch (err) {
        console.log(err);
        irPara(res, "preferencias", "erro", "sistema");
    }

});

// ===================== BAIXAR MEUS DADOS =====================
// Cópia de tudo que o site guarda sobre a conta (nunca inclui a senha).
router.get("/configuracoes/exportar", autenticado, async (req, res) => {

    try {
        const usuario = await get("SELECT * FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        if (!usuario) return res.redirect("/login");

        const { senha, ...dadosConta } = usuario;
        const copia = { gerado_em: new Date().toISOString(), conta: dadosConta };

        if (usuario.tipo === "escola") {
            copia.pedidos = await all("SELECT * FROM solicitacoes WHERE usuario_id = ? ORDER BY data_envio DESC", [usuario.id]);
            copia.repasses = await all("SELECT * FROM repasses WHERE escola_origem_id = ? OR escola_destino_id = ? ORDER BY data_criacao DESC", [usuario.id, usuario.id]);
            copia.relatos = await all("SELECT * FROM relatos WHERE escola_id = ? ORDER BY data_criacao DESC", [usuario.id]);
        } else {
            copia.doacoes = await all("SELECT * FROM doacoes WHERE usuario_id = ? OR email = ? ORDER BY data_envio DESC", [usuario.id, usuario.email]);
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="meus-dados-discoverbook.json"');
        res.send(JSON.stringify(copia, null, 2));
    } catch (err) {
        console.log(err);
        irPara(res, "dados", "erro", "sistema");
    }

});

// ===================== EXCLUIR CONTA =====================
router.post("/configuracoes/excluir-conta", autenticado, async (req, res) => {

    const { senha, confirmacao } = req.body;

    if (!senha) return irPara(res, "dados", "erro", "campos");
    if (String(confirmacao || "").trim().toUpperCase() !== "EXCLUIR") return irPara(res, "dados", "erro", "confirmacao_exclusao");

    try {
        const usuario = await get("SELECT senha FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        if (!usuario) return irPara(res, "dados", "erro", "sistema");

        if (!(await bcrypt.compare(senha, usuario.senha))) return irPara(res, "dados", "erro", "senha_incorreta");

        await run("DELETE FROM usuarios WHERE id = ?", [req.session.usuario_id]);
        req.session.destroy(() => res.redirect("/login"));
    } catch (err) {
        console.log(err);
        irPara(res, "dados", "erro", "sistema");
    }

});

module.exports = router;
