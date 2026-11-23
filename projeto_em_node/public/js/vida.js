/*
 * VIDA: coisas flutuando, aparecer ao rolar e confete.
 * Tudo aqui é enfeite — se o JS falhar, o site continua inteiro funcionando.
 */
(function () {
    "use strict";
    var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var CORES = ["#ff6b8a", "#ffc83d", "#2ec4b6", "#4cc9f0", "#ff9f43", "#8472f4"];
    function azar(a, b) { return a + Math.random() * (b - a); }

    // ---------- 1) LIVROS flutuando nas faixas de seção (atrás do conteúdo) ----------
    var CAPAS = ["/img/livrofa.jpg", "/img/livro2fa.jpg", "/img/livro3fa.jpg", "/img/livro4fa.jpg",
                 "/img/matilda.jpg", "/img/malala.webp", "/img/galinha.webp", "/img/perigoso.jpg"];
    function livrosFlutuando() {
        if (reduz) return;
        // só em seções de largura total, com bastante espaço nas laterais
        var hosts = document.querySelectorAll(".assinatura-section, .livros-section");
        var n = 0;
        hosts.forEach(function (host) {
            host.classList.add("vida-host");
            // um livro no canto de cima de um lado, outro embaixo do lado oposto
            [["left", "right"], ["right", "left"]].forEach(function (lados, i) {
                var el = document.createElement("div");
                el.className = "vida-livro";
                el.setAttribute("aria-hidden", "true");
                el.style[lados[0]] = azar(0.5, 2.5) + "%";
                if (i === 0) el.style.top = azar(8, 18) + "%"; else el.style.bottom = azar(8, 18) + "%";
                el.style.setProperty("--w", Math.round(azar(58, 76)) + "px");
                el.style.setProperty("--giro", (i === 0 ? azar(6, 12) : -azar(6, 12)).toFixed(1) + "deg");
                el.style.setProperty("--d", azar(5, 8).toFixed(1) + "s");
                el.style.setProperty("--atraso", "-" + azar(0, 5).toFixed(1) + "s");
                var img = document.createElement("img");
                img.src = CAPAS[(n++) % CAPAS.length];
                img.alt = "";
                img.loading = "lazy";
                el.appendChild(img);
                host.appendChild(el);
            });
        });
    }

    // ---------- 3) aparecer ao rolar ----------
    function revelarAoRolar() {
        if (reduz || !("IntersectionObserver" in window)) return;
        var seletor = ".assinatura-card, .livro-card, .escola-secao, .doar-cartao-form, .doar-explica, .mini-livro, .pola, " +
                      ".hist-item, .rank-item, .carrinho-card, .valor-card, .membro-card, .idade-card, .acervo-stat-card, .doar-faq-item, .tl-item, .podio";
        var io = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add("vida-in"); io.unobserve(e.target); }
            });
        }, { threshold: 0.12 });
        document.querySelectorAll(seletor).forEach(function (el, i) {
            var topo = el.getBoundingClientRect().top;
            if (topo < window.innerHeight * 0.9) return; // o que já aparece na tela não precisa "entrar"
            el.classList.add("vida-reveal");
            el.style.setProperty("--atraso", ((i % 4) * 0.08).toFixed(2) + "s");
            io.observe(el);
        });
    }

    // ---------- 4) confete quando uma ação dá certo ----------
    function confete() {
        if (reduz) return;
        var q = new URLSearchParams(location.search);
        var ok = q.get("sucesso");
        var silenciosos = ["cancelada", "pedido_cancelado", "relato_excluido", "editada"];
        // só comemora se a mensagem de sucesso estiver mesmo VISÍVEL na tela
        var cartao = document.querySelector(".doar-mensagem-sucesso, .doar-sucesso-cartao, .pedido-sucesso-cartao");
        var cartaoVisivel = cartao && cartao.offsetParent !== null;
        var comemorar = (ok && silenciosos.indexOf(ok) === -1) || cartaoVisivel;
        if (!comemorar) return;
        for (var i = 0; i < 46; i++) {
            var p = document.createElement("i");
            p.className = "vida-confete";
            p.style.left = azar(5, 95) + "%";
            p.style.background = CORES[i % CORES.length];
            p.style.setProperty("--dx", azar(-120, 120) + "px");
            p.style.setProperty("--r", azar(240, 900) + "deg");
            p.style.setProperty("--d", azar(1.8, 3.2).toFixed(2) + "s");
            p.style.animationDelay = azar(0, 0.5).toFixed(2) + "s";
            document.body.appendChild(p);
            setTimeout(function (el) { el.remove(); }.bind(null, p), 4200);
        }
    }

    function iniciar() {
        try { livrosFlutuando(); revelarAoRolar(); confete(); } catch (e) { /* enfeite: nunca quebra o site */ }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
