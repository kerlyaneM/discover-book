// Filtro de busca por título + filtro por faixa escolar (chips) na
// página do acervo. É só visual: mostra/esconde os cards que já vieram
// renderizados do servidor, não faz nenhuma chamada nova ao backend.
document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("acervoGrid");
    if (!grid) return; // acervo vazio, nada pra filtrar

    const inputBusca = document.getElementById("acervoBusca");
    const chips = document.querySelectorAll("#acervoChips .acervo-chip");
    const cards = Array.from(grid.querySelectorAll(".livro-card"));
    const semResultado = document.getElementById("acervoSemResultado");

    let categoriaAtiva = "todos";

    function aplicarFiltros() {
        const termo = (inputBusca?.value || "").trim().toLowerCase();
        let algumVisivel = false;

        cards.forEach((card) => {
            const titulo = (card.dataset.livro || "").toLowerCase();
            const categoria = card.dataset.filtro || "";

            const bateBusca = !termo || titulo.includes(termo);
            const bateCategoria = categoriaAtiva === "todos" || categoria === categoriaAtiva;
            const visivel = bateBusca && bateCategoria;

            card.style.display = visivel ? "" : "none";
            if (visivel) algumVisivel = true;
        });

        if (semResultado) semResultado.hidden = algumVisivel;
    }

    inputBusca?.addEventListener("input", aplicarFiltros);

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            categoriaAtiva = chip.dataset.filtro;
            chips.forEach((c) => c.classList.remove("ativo"));
            chip.classList.add("ativo");
            aplicarFiltros();
        });
    });
});
