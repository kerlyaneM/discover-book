/*
 * Busca global do DiscoverBook.
 * Roda em todas as páginas (o cabeçalho com a barra de pesquisa é o
 * mesmo em todo o site) e procura em TODOS os livros cadastrados no
 * catálogo (public/js/catalogo-livros.js), não só nos que aparecem
 * na página atual.
 */
(function () {

    function normalizar(texto) {
        return (texto || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    document.addEventListener("DOMContentLoaded", function () {

        const input = document.getElementById("searchInput");
        const resultados = document.getElementById("resultadosBusca");
        const catalogo = typeof CATALOGO_LIVROS !== "undefined" ? CATALOGO_LIVROS : [];

        if (!input || !resultados) return;

        function renderResultados(lista, termo) {

            resultados.innerHTML = "";

            if (lista.length === 0) {
                resultados.innerHTML = `<p class="sem-resultado">Nenhum livro encontrado para "${termo}".</p>`;
                resultados.style.display = "block";
                return;
            }

            lista.slice(0, 8).forEach((livro) => {
                const item = document.createElement("div");
                item.className = "resultado-item";
                item.innerHTML = `
                    <img src="${livro.imagem}" alt="">
                    <div>
                        <h4>${livro.titulo}</h4>
                    </div>
                `;
                item.addEventListener("click", () => irParaLivro(livro));
                resultados.appendChild(item);
            });

            resultados.style.display = "block";
        }

        function buscar() {

            const termo = input.value.trim();
            const termoNormalizado = normalizar(termo);

            if (termoNormalizado === "") {
                resultados.style.display = "none";
                resultados.innerHTML = "";
                return [];
            }

            const encontrados = catalogo.filter((livro) =>
                normalizar(livro.titulo).includes(termoNormalizado)
            );

            renderResultados(encontrados, termo);
            return encontrados;
        }

        input.addEventListener("input", buscar);

        input.addEventListener("keyup", function (event) {
            if (event.key === "Enter") {
                const encontrados = buscar();
                if (encontrados.length > 0) {
                    irParaLivro(encontrados[0]);
                }
            }
        });

        // Fecha a lista de resultados ao clicar fora dela
        document.addEventListener("click", function (event) {
            if (!event.target.closest(".search-container")) {
                resultados.style.display = "none";
            }
        });

        // Se a página atual já tem o livro buscado, apenas rola até ele.
        // Caso contrário, manda para a página certa com o nome na URL.
        window.irParaLivro = function (livro) {
            const jaEstaNaPagina = window.location.pathname === livro.pagina
                || (livro.pagina === "/home" && (window.location.pathname === "/" || window.location.pathname === "/home"));

            if (jaEstaNaPagina && destacarLivroNaPagina(livro.titulo)) {
                resultados.style.display = "none";
                return;
            }

            window.location.href = livro.pagina + "?buscar=" + encodeURIComponent(livro.titulo);
        };

        // Ao chegar numa página vinda de uma busca (?buscar=...), rola até
        // o livro e destaca ele por alguns segundos.
        const params = new URLSearchParams(window.location.search);
        const termoUrl = params.get("buscar");
        if (termoUrl) {
            input.value = termoUrl;
            setTimeout(() => destacarLivroNaPagina(termoUrl), 150);
        }

        function destacarLivroNaPagina(titulo) {

            const alvo = normalizar(titulo);
            const cards = document.querySelectorAll(".livro-card");
            let encontrado = null;

            cards.forEach((card) => {
                const h3 = card.querySelector("h3");
                if (h3 && normalizar(h3.innerText) === alvo) {
                    encontrado = card;
                }
            });

            if (!encontrado) return false;

            encontrado.scrollIntoView({ behavior: "smooth", block: "center" });
            encontrado.classList.add("livro-destacado");
            setTimeout(() => encontrado.classList.remove("livro-destacado"), 2500);
            return true;
        }

    });

    // Usado pelo link "Limpar" da barra de pesquisa
    window.limparBusca = function () {
        const input = document.getElementById("searchInput");
        const resultados = document.getElementById("resultadosBusca");
        if (input) input.value = "";
        if (resultados) {
            resultados.style.display = "none";
            resultados.innerHTML = "";
        }
    };

})();
