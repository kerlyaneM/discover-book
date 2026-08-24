document.addEventListener("DOMContentLoaded", () => {
    const olhos = document.querySelectorAll(".olho-senha");

    olhos.forEach(olho => {
        olho.addEventListener("click", () => {
            const inputSenha = olho.previousElementSibling;
            
            // Verificação de segurança para não quebrar se não achar o input
            if (inputSenha) {
                if (inputSenha.type === "password") {
                    inputSenha.type = "text";
                    olho.classList.remove("fa-eye");
                    olho.classList.add("fa-eye-slash");
                } else {
                    inputSenha.type = "password";
                    olho.classList.remove("fa-eye-slash");
                    olho.classList.add("fa-eye");
                }
            }
        });
    });

    // ===================== MEDIDOR DE FORÇA DA SENHA =====================
    // Usado no cadastro (#senha) e na redefinição de senha (#nova_senha).
    // É só um feedback visual pra ajudar a pessoa — a validação de verdade
    // (mínimo 8 caracteres, letra e número) sempre roda no servidor também.
    function calcularForca(senha) {
        if (!senha) return { nivel: 0, texto: "" };

        let pontos = 0;
        if (senha.length >= 8) pontos++;
        if (senha.length >= 12) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/[0-9]/.test(senha)) pontos++;
        if (/[^A-Za-z0-9]/.test(senha)) pontos++;

        if (senha.length < 8) return { nivel: 1, texto: "Fraca — use pelo menos 8 caracteres" };
        if (pontos <= 2) return { nivel: 1, texto: "Fraca — adicione números e letras" };
        if (pontos <= 3) return { nivel: 2, texto: "Média — que tal um símbolo ou letra maiúscula?" };
        return { nivel: 3, texto: "Forte" };
    }

    function ligarMedidorForca(inputId, wrapId, barraId, textoId) {
        const input = document.getElementById(inputId);
        const wrap = document.getElementById(wrapId);
        const barra = document.getElementById(barraId);
        const texto = document.getElementById(textoId);

        if (!input || !wrap || !barra || !texto) return;

        input.addEventListener("input", () => {
            const valor = input.value;

            if (!valor) {
                wrap.hidden = true;
                return;
            }

            wrap.hidden = false;
            const { nivel, texto: mensagem } = calcularForca(valor);

            barra.className = "";
            barra.classList.add("forca-nivel-" + nivel);
            texto.textContent = mensagem;
            texto.className = "forca-senha-texto forca-nivel-" + nivel;
        });
    }

    ligarMedidorForca("senha", "forcaSenhaWrap", "forcaSenhaBarra", "forcaSenhaTexto");
    ligarMedidorForca("nova_senha", "forcaSenhaWrap", "forcaSenhaBarra", "forcaSenhaTexto");

    // ===================== SENHAS IGUAIS (só no cadastro) =====================
    const senha = document.getElementById("senha");
    const confirmarSenha = document.getElementById("confirmar_senha");
    const avisoDiferente = document.getElementById("avisoSenhaDiferente");

    if (senha && confirmarSenha && avisoDiferente) {
        const verificarIguais = () => {
            const digitouAmbos = senha.value && confirmarSenha.value;
            avisoDiferente.hidden = !digitouAmbos || senha.value === confirmarSenha.value;
        };

        senha.addEventListener("input", verificarIguais);
        confirmarSenha.addEventListener("input", verificarIguais);
    }
});