/*
 * Ciclo de vida de um pedido (linha da tabela `solicitacoes`):
 *
 *   Recebida -> Confirmada -> Pronta para retirada -> Entregue
 *       \-> Cancelada (a escola ou a equipe pode cancelar em qualquer
 *                      etapa antes de "Entregue")
 *
 * Esse módulo centraliza o rótulo/cor de cada status e qual é o
 * próximo passo do ciclo, pra rota e as views não repetirem essa regra.
 */

const STATUS_PEDIDO = {
    recebida: { label: "Recebida", cor: "amarelo", icone: "fi-rr-inbox-in" },
    confirmada: { label: "Confirmada", cor: "azul", icone: "fi-rr-check-circle" },
    pronta: { label: "Pronta para retirada", cor: "verde", icone: "fi-rr-box-open" },
    entregue: { label: "Entregue", cor: "cinza", icone: "fi-rr-check-double" },
    cancelada: { label: "Cancelada", cor: "vermelho", icone: "fi-rr-cross-circle" }
};

// Pra cada status "ativo", qual é o próximo passo e o texto do botão que
// a equipe vê no painel (/admin/pedidos) pra avançar o pedido.
const PROXIMO_STATUS = {
    recebida: { proximo: "confirmada", acaoLabel: "Confirmar" },
    confirmada: { proximo: "pronta", acaoLabel: "Marcar como pronta" },
    pronta: { proximo: "entregue", acaoLabel: "Marcar como entregue" }
};

function statusInfo(status) {
    return STATUS_PEDIDO[status] || STATUS_PEDIDO.recebida;
}

// Só é possível cancelar enquanto o pedido não foi entregue nem já está cancelado
function podeCancelar(status) {
    return status !== "entregue" && status !== "cancelada";
}

module.exports = { STATUS_PEDIDO, PROXIMO_STATUS, statusInfo, podeCancelar };
