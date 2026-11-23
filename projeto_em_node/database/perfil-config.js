// Constantes usadas tanto no perfil (doador) quanto na página da escola (/escola/:id)

// Doadores escolhem entre pessoas de vários tons de pele, cabelos, estilos e com/sem óculos
const AVATARES_DOADOR = Array.from({ length: 25 }, (_, i) => "doador-" + String(i + 1).padStart(2, "0") + ".png");

// Escolas escolhem avatares que não são pessoas (livro, coruja, prédio, mochila...)
const AVATARES_ESCOLA = Array.from({ length: 8 }, (_, i) => "escola-" + String(i + 1).padStart(2, "0") + ".svg");

// Todos os avatares válidos (usado para conferir o que chega do formulário)
const AVATARES_DISPONIVEIS = [...AVATARES_DOADOR, ...AVATARES_ESCOLA];

const ETAPAS_ESCOLA = ["Educação infantil", "Fundamental I", "Fundamental II", "Ensino médio", "EJA"];

module.exports = { AVATARES_DOADOR, AVATARES_ESCOLA, AVATARES_DISPONIVEIS, ETAPAS_ESCOLA };
