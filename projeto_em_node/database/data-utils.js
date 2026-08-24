/*
 * O SQLite guarda CURRENT_TIMESTAMP como "YYYY-MM-DD HH:MM:SS" em UTC,
 * sem indicar o fuso horário na string. O `new Date(...)` do Node
 * interpreta esse formato de jeitos diferentes dependendo do fuso
 * horário configurado no servidor onde a aplicação está rodando —
 * o que fazia a data de criação da conta aparecer com o dia errado.
 *
 * Essa função força a leitura da string como UTC (adicionando o "Z"),
 * garantindo que o resultado seja sempre o mesmo, não importa onde o
 * site esteja hospedado. Depois é só formatar com
 * `timeZone: "America/Sao_Paulo"` para mostrar a data certa pro Brasil.
 */
function paraDataUTC(stringData) {
    if (!stringData) return null;

    const normalizada = stringData instanceof Date
        ? stringData.toISOString()
        : stringData.trim().replace(" ", "T") + (stringData.includes("Z") ? "" : "Z");

    const data = new Date(normalizada);
    return isNaN(data) ? null : data;
}

// Quantas horas uma doação fica "pendente" (o doador pode editar ou
// cancelar nesse período) antes de virar automaticamente "disponivel"
// no acervo.
const HORAS_PENDENTE_DOACAO = 48;

// Promove pro acervo (status = 'disponivel') toda doação que já passou
// do prazo de carência. É chamada no início das rotas que leem doações
// (doar, acervo, perfil) em vez de precisar de uma tarefa agendada —
// assim que alguém acessa uma dessas páginas, o status é atualizado.
function promoverDoacoesPendentes(db, callback) {
    db.run(
        `UPDATE doacoes
         SET status = 'disponivel'
         WHERE status = 'pendente'
           AND datetime(data_envio, '+${HORAS_PENDENTE_DOACAO} hours') <= datetime('now')`,
        [],
        (err) => { if (callback) callback(err); }
    );
}

module.exports = { paraDataUTC, promoverDoacoesPendentes, HORAS_PENDENTE_DOACAO };
