
document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll(
        ".sub-assinatura, .assinatura-card"
    );

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                    observer.unobserve(entry.target); 
                    // aparece uma vez só (mais elegante)
                }
            });
        },
        {
            threshold: 0.2
        }
    );

    elements.forEach(el => observer.observe(el));
});

// MENU
function toggleMenu() {
    const menu = document.getElementById("menuCat");
    menu.classList.toggle("ativo");
}

// MENU
function toggleMenu() {
    const menu = document.getElementById("menuCat");
    menu.classList.toggle("ativo");
}

// A busca da barra de pesquisa agora é feita pelo public/js/busca-global.js,
// carregado no cabeçalho e usado em todas as páginas do site.