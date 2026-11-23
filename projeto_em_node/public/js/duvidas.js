/* Página de Dúvidas: troca de perfil, cards e trilha do pedido */
var D={doador:[["🎁","Qualquer pessoa pode doar?","Pode sim! Crie sua conta de doador e cadastre o livro com uma foto."],["📖","Que livro posso doar?","Livros em bom estado: infantis, didáticos e de leitura."],["🔎","Como sei que foi entregue?","É só olhar o status no seu perfil. Quando virar “Entregue”, missão cumprida!"]],
escola:[["🏫","Quem pode ser escola?","Instituições de ensino, com prioridade para escolas públicas de Ribamar."],["🛒","Como peço livros?","Escolha no acervo, coloque no carrinho e finalize. A equipe faz o resto."],["🔁","O que é repasse?","Sobrou livro? Ofereça para outra escola que está precisando."]]};
var P=["Chegou pra gente! Seu pedido está na fila da equipe.","A equipe conferiu tudo e confirmou seu pedido.","Livros separados! Já pode ir retirar.","Livro na mão de quem precisa. Missão cumprida! 🎉"];
var g=document.getElementById("grid");
function draw(p){g.innerHTML="";D[p].forEach(function(c,i){var b=document.createElement("button");b.className="card c"+i;b.style.animationDelay=i*90+"ms";
b.innerHTML='<span class="e">'+c[0]+'</span><div><h3>'+c[1]+'</h3><span class="a">'+c[2]+'</span><span class="t">Toque pra ver ›</span></div>';
b.onclick=function(){b.classList.toggle("aberta")};g.appendChild(b)})}
document.getElementById("quem").onclick=function(e){var b=e.target.closest("button");if(!b)return;
[].forEach.call(this.children,function(x){x.classList.remove("on")});b.classList.add("on");draw(b.dataset.p)};
var sts=[].slice.call(document.querySelectorAll(".st")),liv=document.getElementById("liv"),bal=document.getElementById("bal"),cur=0,t;
function go(i){cur=i;sts.forEach(function(s,k){s.classList.toggle("on",k===i)});liv.style.left=(12.5+25*i)+"%";bal.textContent=P[i]}
function auto(){clearInterval(t);t=setInterval(function(){go((cur+1)%4)},3200)}
sts.forEach(function(s){s.onclick=function(){go(+s.dataset.i);auto()}});
draw("doador");go(0);auto();
