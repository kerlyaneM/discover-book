// Setas dos carrosséis das páginas de faixa escolar (Infantil / Fundamental / Médio).
// Rola quase uma "página" por clique e desativa a seta quando chega no fim.
document.querySelectorAll(".area-carrossel").forEach(function (area) {
    var trilho = area.querySelector(".carrossel-livros");
    var esq = area.querySelector(".esquerda");
    var dir = area.querySelector(".direita");
    if (!trilho || !esq || !dir) return;

    function atualizar() {
        var max = trilho.scrollWidth - trilho.clientWidth - 4;
        esq.disabled = trilho.scrollLeft <= 4;
        dir.disabled = trilho.scrollLeft >= max;
    }
    function passo() { return Math.max(240, trilho.clientWidth * 0.85); }

    dir.addEventListener("click", function () { trilho.scrollBy({ left: passo(), behavior: "smooth" }); });
    esq.addEventListener("click", function () { trilho.scrollBy({ left: -passo(), behavior: "smooth" }); });
    trilho.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
    atualizar();
});
