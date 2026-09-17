"use client";

import { useState } from "react";

const adicionais = [
["Banana",0],["Granola",0],["Amendoim",0],["Paçoca",0],
["Leite em pó",0],["Confete",0],["Coco ralado",0],
["Leite condensado",0],["Bis",0],
["Morango",3],["Kiwi",3],["Creme de avelã",3],["Oreo",3]
];

const bairros = [
["Centro",10],["Alvorada",10],["Cango",10],["Kennedy",10],
["Cristo Rei",10],["Guanabara",11],["São Francisco",11],
["Alto da Julio",12],["Industrial",12],["Marrecas",12],
["Vila Nova",12],["Novo Mundo",12],["Novo Horizonte",12],
["Aeroporto",13],["Bom Pastor",13],["Seminário",13],
["Raffer",13],["Água Branca",14],["Jardim Floresta",14],
["Jardim Itália",12],["Primavera",14],["Júpiter",14],
["Miniguaçu",14],["Pinheirinho",14],["Pinheirão",15],
["Terra Nossa",15],["Sadia",15],["São Marcos",18],
["Pedra Branca M",18],["Nortão",20],["Santa Bárbara",20],
["Centro M",30],["Ipiranga M",30],["Marmeleiro",30],
["Passarela M",30]
];

export default function Home(){
 const [selecionados,setSelecionados]=useState([]);

 function add(nome){
   if(selecionados.includes(nome)){
    setSelecionados(selecionados.filter(x=>x!==nome))
   }else{
    setSelecionados([...selecionados,nome])
   }
 }

 return (
 <main className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-700 text-white">
   <header className="p-6 text-center">
    <img src="/logo.png" className="w-44 mx-auto rounded-xl"/>
    <h1 className="text-4xl font-bold text-yellow-300 mt-5">Monte seu açaí do seu jeito 🍧</h1>
    <p>Delivery em Francisco Beltrão - PR</p>
    <p>Segunda a Domingo • 13h às 22h</p>
   </header>

   <section className="max-w-5xl mx-auto p-6 grid md:grid-cols-3 gap-5">
    {[
    ["300ml","R$18,00"],
    ["400ml","R$20,00"],
    ["500ml","R$22,00"]
    ].map(p=>
     <div className="bg-white text-purple-900 rounded-2xl p-6 shadow-xl" key={p[0]}>
      <h2 className="text-2xl font-bold">Açaí {p[0]}</h2>
      <p className="text-3xl text-purple-700">{p[1]}</p>
      <p>Escolha 4 complementos</p>
     </div>
    )}
   </section>

   <section className="bg-white text-purple-900 p-8">
    <h2 className="text-3xl font-bold text-center">Complementos</h2>
    <div className="grid md:grid-cols-4 gap-3 mt-5 max-w-6xl mx-auto">
     {adicionais.map(a=>
      <button onClick={()=>add(a[0])} key={a[0]}
      className="border rounded-xl p-3 hover:bg-yellow-300">
       {a[0]} {a[1] ? "+R$3":""}
      </button>
     )}
    </div>
    <p className="text-center mt-5">
     Selecionados: {selecionados.length}/4
    </p>
   </section>

   <section className="p-8 max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold">Marmita 1kg</h2>
    <p className="text-yellow-300 text-3xl">R$45,00</p>
    <p>Escolha 6 complementos</p>
   </section>

   <section className="bg-purple-950 p-8">
    <h2 className="text-3xl font-bold">Entrega</h2>
    <p>Também temos retirada no local.</p>
    <div className="grid md:grid-cols-5 gap-2 mt-5">
    {bairros.map(b=><div className="bg-purple-700 rounded p-2" key={b[0]}>
     {b[0]}<br/>R$ {b[1]},00
    </div>)}
    </div>
   </section>

   <footer className="p-8 text-center">
    <h2 className="text-2xl">Pagamento</h2>
    <p>PIX • Cartão • Dinheiro</p>
    <a className="inline-block mt-5 bg-yellow-400 text-purple-900 px-6 py-3 rounded-full font-bold"
    href="https://wa.me/message/KONPQZAX7CH2L1">
    Pedir pelo WhatsApp
    </a>
   </footer>
 </main>
 )
}