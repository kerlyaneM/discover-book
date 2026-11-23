/*
 * Relatos (escola mostra o livro em uso).
 * 1) Preenche a capa dos livros usando o CATALOGO_LIVROS (catalogo-livros.js,
 *    carregado pelo header) — mesma fonte que a busca já usa. Se o título não
 *    estiver no catálogo, a capa simplesmente não aparece.
 * 2) No formulário: prévia da foto, contador de caracteres e botão só liga
 *    quando livro + foto + frase + autorização estão preenchidos.
 */
(function () {
    function normalizar(t) {
        return (t || "").toString().trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function acharCapa(titulo) {
        if (typeof CATALOGO_LIVROS === "undefined") return null;
        var chave = normalizar(titulo);
        for (var i = 0; i < CATALOGO_LIVROS.length; i++) {
            if (normalizar(CATALOGO_LIVROS[i].titulo) === chave) return CATALOGO_LIVROS[i].imagem;
        }
        return null;
    }

    // ---- capas ----
    document.querySelectorAll("img[data-capa-livro]").forEach(function (img) {
        var src = acharCapa(img.getAttribute("data-capa-livro"));
        if (src) { img.src = src; img.hidden = false; }
    });
    document.querySelectorAll("[data-capa-picker]").forEach(function (box) {
        var src = acharCapa(box.getAttribute("data-capa-picker"));
        var img = box.querySelector("img");
        var icone = box.querySelector(".rel-livro-icone");
        if (src && img) { img.src = src; img.hidden = false; if (icone) icone.hidden = true; }
    });

    // ---- formulário ----
    var form = document.getElementById("form-relato");
    if (!form) return;

    var foto = form.querySelector("#rel-foto");
    var drop = form.querySelector(".rel-drop");
    var prev = form.querySelector(".rel-drop-prev");
    var erroFoto = form.querySelector("#rel-foto-erro");
    var frase = form.querySelector("#rel-frase");
    var contador = form.querySelector("#rel-contador");
    var aut = form.querySelector("#rel-aut");
    var botao = form.querySelector("button[type=submit]");
    var MAX_BYTES = 5 * 1024 * 1024;

    function validar() {
        var livro = form.querySelector("input[name=solicitacao_id]:checked");
        var ok = livro && foto.files && foto.files.length > 0 &&
                 frase.value.trim().length >= 3 && aut.checked;
        botao.disabled = !ok;
    }

    foto.addEventListener("change", function () {
        erroFoto.textContent = "";
        var arq = foto.files[0];
        if (!arq) { drop.classList.remove("tem-foto"); validar(); return; }
        if (arq.size > MAX_BYTES) {
            foto.value = "";
            drop.classList.remove("tem-foto");
            erroFoto.textContent = "A foto passa de 5 MB. Escolha uma menor.";
            validar();
            return;
        }
        prev.src = URL.createObjectURL(arq);
        drop.classList.add("tem-foto");
        validar();
    });

    frase.addEventListener("input", function () {
        contador.textContent = frase.value.length + "/" + frase.maxLength;
        validar();
    });
    form.addEventListener("change", validar);
    contador.textContent = "0/" + frase.maxLength;
    validar();
})();
