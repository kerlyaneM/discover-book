/* Menu principal: abre/fecha ao tocar ou clicar (e ao passar o mouse no computador). */
(function () {
    "use strict";
    var drop = document.getElementById("menuDrop");
    var btn = document.getElementById("menuBtn");
    var painel = document.getElementById("menuPainel");
    if (!drop || !btn || !painel) return;

    var podeHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
    var fecharTimer = null;

    var fixo = false; // true = a pessoa clicou/tocou: fica aberto até clicar de novo, Esc ou fora

    function abrir() {
        clearTimeout(fecharTimer);
        painel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
    }
    function fechar() {
        fixo = false;
        painel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
    }
    function aberto() { return !painel.hidden; }

    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!aberto()) { fixo = true; abrir(); return; }
        // no computador o mouse já abriu o painel; o clique então "prende" ele aberto
        if (podeHover && !fixo) { fixo = true; return; }
        fechar();
    });

    // computador: também abre ao passar o mouse (com uma folguinha pra não fechar sem querer)
    if (podeHover) {
        drop.addEventListener("mouseenter", abrir);
        drop.addEventListener("mouseleave", function () {
            if (fixo) return;
            fecharTimer = setTimeout(fechar, 220);
        });
    }

    // fecha ao tocar fora, apertar Esc ou escolher um link
    document.addEventListener("click", function (e) { if (aberto() && !drop.contains(e.target)) fechar(); });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && aberto()) { fechar(); btn.focus(); }
    });
    painel.addEventListener("click", function (e) { if (e.target.closest("a")) fechar(); });
})();
