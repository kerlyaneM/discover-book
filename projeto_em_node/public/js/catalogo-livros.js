/*
 * Catálogo central com TODOS os livros do site (de todas as páginas).
 * Usado pela barra de pesquisa do cabeçalho (busca-global.js) para
 * encontrar um livro não importa em qual página o usuário esteja.
 *
 * Se um novo livro for adicionado em alguma página (home, infantil,
 * idade3-5, idade6-10...), adicione ele aqui também para que a busca
 * consiga encontrá-lo.
 */
const CATALOGO_LIVROS = [
    { titulo: "O Pequeno Príncipe", imagem: "/img/livrofa.jpg", pagina: "/home" },
    { titulo: "Turma da Mônica", imagem: "/img/livro2fa.jpg", pagina: "/home" },
    { titulo: "O Mágico de Oz", imagem: "/img/livro3fa.jpg", pagina: "/home" },
    { titulo: "A Galinha Vermelha", imagem: "/img/galinha.webp", pagina: "/infantil" },
    { titulo: "Explorando com os Animais", imagem: "/img/animais.jpg", pagina: "/infantil" },
    { titulo: "Chapeuzinho Vermelho", imagem: "/img/chapeuzinho.webp", pagina: "/infantil" },
    { titulo: "Um Encontro", imagem: "/img/encontro.webp", pagina: "/infantil" },
    { titulo: "perigoso", imagem: "/img/perigoso.jpg", pagina: "/idade3-5" },
    { titulo: "o ursinho apavorado", imagem: "/img/oursinhoapavorado.jpg", pagina: "/idade3-5" },
    { titulo: "Matilda", imagem: "/img/matilda.jpg", pagina: "/idade3-5" },
    { titulo: "malala", imagem: "/img/malala.webp", pagina: "/idade3-5" },
    { titulo: "A menina que não sabia esperar", imagem: "/img/ameninaquenaosabiaesperar.jpg", pagina: "/idade6-10" },
    { titulo: "assim como voce", imagem: "/img/assimcomovoce.jpg", pagina: "/idade6-10" },
    { titulo: "A crianca do 6 aos 10 anos", imagem: "/img/criancado6ao11anos.jpg", pagina: "/idade6-10" }
];
