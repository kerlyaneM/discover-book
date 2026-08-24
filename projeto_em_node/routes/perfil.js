const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { paraDataUTC, promoverDoacoesPendentes, HORAS_PENDENTE_DOACAO } = require("../database/data-utils");
const { statusInfo, podeCancelar } = require("../database/status-utils");

function autenticado(req, res, next) {
    if (req.session && req.session.usuario_id) {
        return next();
    }

    res.redirect("/login");
}

// Avatares pré-definidos que o usuário pode escolher (fica em public/img/avatars)
const AVATARES_DISPONIVEIS = [
    "avatar1.svg",
    "avatar2.svg",
    "avatar3.svg",
    "avatar4.svg",
    "avatar5.svg",
    "avatar6.svg"
];

// Define o "nível" de doador a partir da quantidade total de livros doados
function calcularNivel(totalLivros) {
    if (totalLivros >= 60) return "Diamante";
    if (totalLivros >= 30) return "Ouro";
    if (totalLivros >= 15) return "Prata";
    if (totalLivros >= 5) return "Bronze";
    return "Iniciante";
}

function mesesDeConta(dataCriacao) {
    const d = paraDataUTC(dataCriacao);
    if (!d) return 0;
    const meses = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.max(0, Math.floor(meses));
}

// ===================== VER PERFIL =====================
router.get("/perfil", autenticado, (req, res) => {

    promoverDoacoesPendentes(db, () => {

    db.get(
        "SELECT * FROM usuarios WHERE id = ?",
        [req.session.usuario_id],
        (err, usuario) => {

            if (err || !usuario) {
                return res.redirect("/home");
            }

            // Dados comuns às duas telas de perfil (escola e doador)
            const respostaComum = {
                perfilUsuario: usuario,
                editar: req.query.editar === "1",
                avatares: AVATARES_DISPONIVEIS,
                sucessoPerfil: req.query.sucesso || null,
                erroPerfil: req.query.erro || null,
                sugestoesPerfil: req.query.sugestoes ? req.query.sugestoes.split(",") : [],
                horasPendente: HORAS_PENDENTE_DOACAO
            };

            // Escola vê o histórico das solicitações (carrinho) que enviou;
            // doador vê os livros que já doou e o ranking de doadores.
            if (usuario.tipo === "escola") {

                const abaEscola = req.query.aba === "ranking" ? "ranking" : "carrinho";

                db.all(
                    "SELECT * FROM solicitacoes WHERE usuario_id = ? ORDER BY data_envio DESC",
                    [usuario.id],
                    (err2, solicitacoes) => {
                        const itensComStatus = (solicitacoes || []).map((item) => {
                            const status = item.status || "recebida";
                            return {
                                ...item,
                                statusInfo: statusInfo(status),
                                cancelavel: podeCancelar(status)
                            };
                        });

                        // Ranking "Escolas parceiras": separado do ranking de doadores,
                        // baseado na quantidade de livros que a escola REPASSOU (e teve
                        // aprovada) para outras escolas — não tem relação com doação
                        // de pessoa física nem com solicitações recebidas.
                        db.all(
                            `SELECT u.id, u.username, u.nome, u.avatar, u.data_criacao,
                                    COALESCE(SUM(r.quantidade), 0) AS totalRepassado
                             FROM usuarios u
                             LEFT JOIN repasses r ON r.escola_origem_id = u.id AND r.status = 'aprovado'
                             WHERE u.tipo = 'escola'
                             GROUP BY u.id`,
                            [],
                            (err3, escolas) => {

                                const rankingEscolas = (escolas || [])
                                    .map((e) => ({
                                        id: e.id,
                                        nome: e.username || e.nome,
                                        foto: e.avatar ? "/img/avatars/" + e.avatar : "/img/perfil-padrao.jpg",
                                        totalLivros: e.totalRepassado
                                    }))
                                    .sort((a, b) => b.totalLivros - a.totalLivros);

                                const totalRepassado = rankingEscolas.find((e) => e.id === usuario.id);

                                res.render("perfil", {
                                    ...respostaComum,
                                    itens: itensComStatus,
                                    ranking: rankingEscolas,
                                    totalLivrosRepassados: totalRepassado ? totalRepassado.totalLivros : 0,
                                    aba: abaEscola
                                });
                            }
                        );
                    }
                );

            } else {

                const aba = req.query.aba === "ranking" ? "ranking" : "doados";

                db.all(
                    "SELECT * FROM doacoes WHERE usuario_id = ? OR email = ? ORDER BY data_envio DESC",
                    [usuario.id, usuario.email],
                    (err2, doacoes) => {

                        // O ranking é calculado sempre (não só na aba "ranking"), pois o
                        // banner do perfil também mostra o nível/posição atual do doador.
                        db.all(
                            `SELECT u.id, u.username, u.nome, u.avatar, u.foto, u.data_criacao,
                                    COALESCE(SUM(d.quantidade), 0) AS totalLivros
                             FROM usuarios u
                             LEFT JOIN doacoes d ON d.usuario_id = u.id
                             WHERE u.tipo = 'doador'
                             GROUP BY u.id`,
                            [],
                            (err3, doadores) => {

                                const ranking = (doadores || [])
                                    .map((d) => {
                                        const meses = mesesDeConta(d.data_criacao);
                                        return {
                                            id: d.id,
                                            nome: d.username || d.nome,
                                            foto: d.avatar ? "/img/avatars/" + d.avatar : "/img/perfil-padrao.jpg",
                                            totalLivros: d.totalLivros,
                                            meses,
                                            nivel: calcularNivel(d.totalLivros),
                                            pontos: d.totalLivros * 10 + Math.min(meses, 36)
                                        };
                                    })
                                    .sort((a, b) => b.pontos - a.pontos);

                                res.render("perfil", {
                                    ...respostaComum,
                                    itens: doacoes || [],
                                    ranking,
                                    totalLivrosRepassados: 0,
                                    aba
                                });
                            }
                        );
                    }
                );

            }

        }
    );

    });

});

// Gera sugestões de nome de perfil disponíveis a partir de um nome já em uso
function gerarSugestoesUsername(base, usuarioId, callback) {

    const candidatos = [];
    for (let i = 1; i <= 20 && candidatos.length < 12; i++) {
        candidatos.push(base + i);
    }
    candidatos.push(base + "_" + Math.floor(100 + Math.random() * 900));
    candidatos.push(base + "." + Math.floor(10 + Math.random() * 90));
    candidatos.push(base + "_oficial");

    db.all(
        "SELECT LOWER(username) AS username FROM usuarios WHERE id != ?",
        [usuarioId],
        (err, linhas) => {

            const emUso = new Set((linhas || []).map((l) => l.username));
            const disponiveis = candidatos.filter((c) => !emUso.has(c.toLowerCase()));

            callback(disponiveis.slice(0, 3));

        }
    );

}

// ===================== EDITAR PERFIL =====================
router.post("/perfil", autenticado, (req, res) => {

    const { username, avatar } = req.body;

    if (!username || !username.trim()) {
        return res.redirect("/perfil?editar=1&erro=username");
    }

    const usernameLimpo = username.trim();
    const avatarEscolhido = avatar && AVATARES_DISPONIVEIS.includes(avatar) ? avatar : null;

    // Garante que não existe outro usuário com o mesmo nome de perfil
    db.get(
        "SELECT id FROM usuarios WHERE LOWER(username) = LOWER(?) AND id != ?",
        [usernameLimpo, req.session.usuario_id],
        (err, existente) => {

            if (err) {
                console.log(err);
                return res.redirect("/perfil?editar=1&erro=sistema");
            }

            if (existente) {
                return gerarSugestoesUsername(usernameLimpo, req.session.usuario_id, (sugestoes) => {
                    const query = sugestoes.length
                        ? "&erro=username_existe&sugestoes=" + encodeURIComponent(sugestoes.join(","))
                        : "&erro=username_existe";
                    res.redirect("/perfil?editar=1" + query);
                });
            }

            db.run(
                `UPDATE usuarios
                 SET username = ?,
                     avatar = COALESCE(?, avatar)
                 WHERE id = ?`,
                [
                    usernameLimpo,
                    avatarEscolhido,
                    req.session.usuario_id
                ],
                function (err2) {

                    if (err2) {
                        console.log(err2);
                        return res.redirect("/perfil?editar=1&erro=sistema");
                    }

                    // Mantém a sessão sincronizada para que o nome e o
                    // avatar novos apareçam imediatamente no cabeçalho.
                    req.session.usuario_nome = usernameLimpo;
                    if (avatarEscolhido) req.session.usuario_foto = "/img/avatars/" + avatarEscolhido;

                    res.redirect("/perfil");
                }
            );

        }
    );

});

module.exports = router;
