// Interações da página de Configurações (tudo é opcional: sem JS os formulários continuam funcionando)
document.addEventListener("DOMContentLoaded", function () {

    // ---------- Mostrar / ocultar senha ----------
    document.querySelectorAll(".config-ver-senha").forEach(function (botao) {
        botao.addEventListener("click", function () {
            var campo = document.getElementById(botao.dataset.alvo);
            if (!campo) return;
            var mostrar = campo.type === "password";
            campo.type = mostrar ? "text" : "password";
            botao.textContent = mostrar ? "Ocultar" : "Mostrar";
            botao.setAttribute("aria-label", (mostrar ? "Ocultar " : "Mostrar ") + "senha");
        });
    });

    // ---------- Alterar senha: força, requisitos e confirmação ----------
    var formSenha = document.getElementById("form-senha");
    if (formSenha) {
        var atual = document.getElementById("senha_atual");
        var nova = document.getElementById("nova_senha");
        var confirmar = document.getElementById("confirmar_senha");
        var forca = document.getElementById("forca-senha");
        var textoForca = forca.querySelector(".config-forca-texto");
        var aviso = document.getElementById("aviso-confirmacao");
        var requisitos = {
            tamanho: document.querySelector('[data-req="tamanho"]'),
            mistura: document.querySelector('[data-req="mistura"]'),
            diferente: document.querySelector('[data-req="diferente"]')
        };
        var nomes = ["", "Fraca", "Razoável", "Boa", "Forte"];

        var marcar = function (item, ok) {
            item.classList.toggle("ok", ok);
            item.querySelector("span").textContent = ok ? "✓" : "○";
        };

        var atualizar = function () {
            var s = nova.value;
            var temTamanho = s.length >= 6;
            var temMistura = /[A-Za-z]/.test(s) && /\d/.test(s);
            var diferente = s.length > 0 && s !== atual.value;

            marcar(requisitos.tamanho, temTamanho);
            marcar(requisitos.mistura, temMistura);
            marcar(requisitos.diferente, diferente);

            var nivel = 0;
            if (s.length > 0) {
                nivel = 1;
                if (temTamanho && temMistura) nivel = 2;
                if (s.length >= 8 && temMistura) nivel = 3;
                if (s.length >= 10 && temMistura && /[^A-Za-z0-9]/.test(s)) nivel = 4;
                if (!temTamanho) nivel = 1;
            }
            forca.dataset.nivel = nivel;
            textoForca.textContent = nivel ? "Senha " + nomes[nivel].toLowerCase() : "Digite uma senha para ver a força.";

            if (confirmar.value.length === 0) {
                aviso.textContent = "";
                aviso.className = "config-confirmacao";
            } else if (confirmar.value === s) {
                aviso.textContent = "As senhas conferem.";
                aviso.className = "config-confirmacao ok";
            } else {
                aviso.textContent = "As senhas ainda não são iguais.";
                aviso.className = "config-confirmacao erro";
            }
        };

        [atual, nova, confirmar].forEach(function (c) { c.addEventListener("input", atualizar); });

        formSenha.addEventListener("submit", function (e) {
            if (nova.value !== confirmar.value) {
                e.preventDefault();
                atualizar();
                confirmar.focus();
            }
        });
    }

    // ---------- Preferências: só habilita "Salvar" quando algo mudou ----------
    var formPref = document.getElementById("form-preferencias");
    if (formPref) {
        var botaoPref = document.getElementById("btn-salvar-pref");
        var avisoPref = document.getElementById("aviso-pref");
        var inputs = formPref.querySelectorAll('input[type="checkbox"]');
        var inicial = Array.prototype.map.call(inputs, function (i) { return i.checked; });

        var verificar = function () {
            var mudou = Array.prototype.some.call(inputs, function (i, n) { return i.checked !== inicial[n]; });
            botaoPref.disabled = !mudou;
            avisoPref.textContent = mudou ? "Você tem alterações para salvar." : "Nenhuma alteração ainda.";
        };

        inputs.forEach(function (i) { i.addEventListener("change", verificar); });
    }

    // ---------- Excluir conta: só libera o botão com "EXCLUIR" + senha ----------
    var formExcluir = document.getElementById("form-excluir");
    if (formExcluir) {
        var palavra = document.getElementById("confirmacao_exclusao");
        var senhaExcluir = document.getElementById("senha_exclusao");
        var botaoExcluir = document.getElementById("btn-excluir");

        var liberar = function () {
            botaoExcluir.disabled = !(palavra.value.trim().toUpperCase() === "EXCLUIR" && senhaExcluir.value.length > 0);
        };

        palavra.addEventListener("input", liberar);
        senhaExcluir.addEventListener("input", liberar);
        liberar();
    }

});
