// ================== CARRINHO GLOBAL (gaveta em todas as páginas) ==================

function formatarItemGaveta(item) {
    return `
        <div class="gaveta-item" data-id="${item.id}">
            <img src="${item.imagem}" alt="Capa do livro ${item.nome}">
            <div class="gaveta-item-info">
                <h3>${item.nome}</h3>
                ${item.categoria ? `<span>${item.categoria}</span>` : ""}
                <div class="gaveta-item-qtd">
                    <button type="button" class="qtd-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade - 1})" aria-label="Diminuir quantidade">−</button>
                    <span class="qtd-valor">${item.quantidade}</span>
                    <button type="button" class="qtd-btn" onclick="alterarQuantidade('${item.id}', ${item.quantidade + 1})" aria-label="Aumentar quantidade">+</button>
                </div>
            </div>
            <button type="button" class="gaveta-item-remover" onclick="removerDoCarrinho('${item.id}')" aria-label="Remover ${item.nome} do carrinho">✕</button>
        </div>
    `;
}

function renderizarGaveta(itens, totalItens) {
    const lista = document.getElementById("gavetaLista");
    const totalSpan = document.getElementById("gavetaTotalItens");
    if (!lista || !totalSpan) return;

    if (!itens || itens.length === 0) {
        lista.innerHTML = `
            <div class="gaveta-vazia">
                <i class="fi fi-rr-shopping-cart"></i>
                <span>Seu carrinho está vazio.<br>Adicione livros para solicitar.</span>
            </div>
        `;
    } else {
        lista.innerHTML = itens.map(formatarItemGaveta).join("");
    }

    totalSpan.textContent = totalItens || 0;

    const badge = document.getElementById("badgeCarrinho");
    if (badge) {
        if (totalItens > 0) {
            badge.textContent = totalItens;
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    // Se a página do carrinho completo estiver aberta, atualiza ela também
    if (typeof renderizarPaginaCarrinho === "function") {
        renderizarPaginaCarrinho(itens, totalItens);
    }
}

function abrirCarrinho() {
    const overlay = document.getElementById("overlayCarrinho");
    if (overlay) {
        overlay.classList.add("aberta");
        document.body.style.overflow = "hidden";
    }
}

function fecharCarrinho() {
    const overlay = document.getElementById("overlayCarrinho");
    if (overlay) {
        overlay.classList.remove("aberta");
        document.body.style.overflow = "";
    }
}

async function carregarCarrinho() {
    try {
        const resp = await fetch("/carrinho/dados");
        const dados = await resp.json();
        if (dados.ok) renderizarGaveta(dados.itens, dados.totalItens);
    } catch (e) {
        console.error("Não foi possível carregar o carrinho.", e);
    }
}

async function adicionarAoCarrinho(botao) {
    const card = botao.closest(".livro-card") || botao.closest("[data-livro]");
    if (!card) return;

    const nome = (card.dataset.livro || card.querySelector("h3")?.textContent || "Livro").trim();
    const imagem = card.dataset.imagem || card.querySelector("img")?.getAttribute("src") || "/img/perfil-padrao.jpg";
    const secao = card.closest("section");
    const categoria = card.dataset.categoria || secao?.querySelector("h2")?.textContent?.trim() || "";
    const faixa = document.title.split(" - ")[0] || "";

    botao.disabled = true;

    try {
        const resp = await fetch("/carrinho/adicionar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, imagem, categoria, faixa })
        });
        const dados = await resp.json();

        if (dados.ok) {
            renderizarGaveta(dados.itens, dados.totalItens);
            abrirCarrinho();
        }
    } catch (e) {
        console.error("Erro ao adicionar ao carrinho.", e);
    } finally {
        botao.disabled = false;
    }
}

async function alterarQuantidade(id, novaQuantidade) {
    if (novaQuantidade < 1) {
        return removerDoCarrinho(id);
    }

    try {
        const resp = await fetch("/carrinho/atualizar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, quantidade: novaQuantidade })
        });
        const dados = await resp.json();
        if (dados.ok) renderizarGaveta(dados.itens, dados.totalItens);
    } catch (e) {
        console.error("Erro ao atualizar quantidade.", e);
    }
}

async function removerDoCarrinho(id) {
    try {
        const resp = await fetch("/carrinho/remover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const dados = await resp.json();
        if (dados.ok) renderizarGaveta(dados.itens, dados.totalItens);
    } catch (e) {
        console.error("Erro ao remover item.", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarCarrinho();

    const btnAbrir = document.getElementById("btnAbrirCarrinho");
    const btnFechar = document.getElementById("btnFecharCarrinho");
    const overlay = document.getElementById("overlayCarrinho");

    if (btnAbrir) btnAbrir.addEventListener("click", abrirCarrinho);
    if (btnFechar) btnFechar.addEventListener("click", fecharCarrinho);
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) fecharCarrinho();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") fecharCarrinho();
    });
});
