"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import image300 from "../../images/produto-300.jpg";
import image400 from "../../images/produto-400.png";
import image500 from "../../images/produto-500.png";
import image1kg from "../../images/produto-1kg.jpg";

const defaults = [
  {id:"demo-300",name:"Açaí 300ml",price:18,addons_limit:4,size_ml:300,is_active:true},
  {id:"demo-400",name:"Açaí 400ml",price:20,addons_limit:4,size_ml:400,is_active:true},
  {id:"demo-500",name:"Açaí 500ml",price:22,addons_limit:4,size_ml:500,is_active:true},
  {id:"demo-1000",name:"Marmita 1kg",price:45,addons_limit:6,size_ml:1000,is_active:true}
];
const defaultAddons=["Banana","Granola","Amendoim","Paçoca","Leite em pó","Confete","Coco ralado","Leite condensado","Bis","Morango","Kiwi","Creme de avelã","Oreo"].map((name,i)=>({id:"demo-addon-"+i,name,price:i>=9?3:0,is_active:true}));
const defaultAreas=[["Centro",10],["Alvorada",10],["Cango",10],["Kennedy",10],["Cristo Rei",10],["Guanabara",11],["São Francisco",11],["Alto da Julio",12],["Industrial",12],["Marrecas",12],["Vila Nova",12],["Novo Mundo",12],["Novo Horizonte",12],["Aeroporto",13],["Bom Pastor",13],["Seminário",13],["Raffer",13],["Água Branca",14],["Jardim Floresta",14],["Jardim Itália",12],["Primavera",14],["Júpiter",14],["Miniguaçu",14],["Pinheirinho",14],["Pinheirão",15],["Terra Nossa",15],["Sadia",15],["São Marcos",18],["Pedra Branca M",18],["Nortão",20],["Santa Bárbara",20],["Centro M",30],["Ipiranga M",30],["Marmeleiro",30],["Passarela M",30]].map(([name,fee],i)=>({id:"demo-area-"+i,name,fee,is_active:true}));
const images={300:image300,400:image400,500:image500,1000:image1kg};
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const cfgUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const cfgKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db=cfgUrl&&cfgKey?createClient(cfgUrl,cfgKey):null;

function scheduleOpen(settings){
  if(!settings.accepting_orders)return false;
  if(!settings.open_days || !settings.opening_time || !settings.closing_time)return true;
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const value=t=>parts.find(x=>x.type===t)?.value;
  const wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[value("weekday")];
  const now=Number(value("hour"))*60+Number(value("minute"));
  const mins=s=>{const p=String(s).split(":").map(Number);return p[0]*60+p[1]};
  const from=mins(settings.opening_time),to=mins(settings.closing_time);
  if(from<=to)return settings.open_days.includes(wd)&&now>=from&&now<to;
  return (settings.open_days.includes(wd)&&now>=from)||(settings.open_days.includes((wd+6)%7)&&now<to);
}
export default function Home(){
 const [products,setProducts]=useState(defaults);
 const [addons,setAddons]=useState(defaultAddons);
 const [areas,setAreas]=useState(defaultAreas);
 const [settings,setSettings]=useState({accepting_orders:true,whatsapp_number:"",open_days:null,opening_time:null,closing_time:null});
 const [backend,setBackend]=useState(false);
 const [selectedId,setSelectedId]=useState("demo-300");
 const [extras,setExtras]=useState([]);
 const [cart,setCart]=useState([]);
 const [form,setForm]=useState({name:"",phone:"",fulfillment:"delivery",area:"",address:"",payment:"PIX"});
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
   if(!db)return;
   let alive=true;
   Promise.all([
     db.from("products").select("*").eq("is_active",true).order("sort_order"),
     db.from("addons").select("*").eq("is_active",true).order("sort_order"),
     db.from("delivery_areas").select("*").eq("is_active",true).order("name"),
     db.from("store_settings").select("*").eq("id",1).single()
   ]).then(([p,a,z,s])=>{
     if(!alive)return;
     if(p.error||a.error||z.error||s.error){setMessage("O banco está indisponível. O cardápio demonstrativo está sendo exibido; pedidos não serão registrados.");return;}
     setProducts(p.data||[]);setAddons(a.data||[]);setAreas(z.data||[]);
     setSettings(s.data);setBackend(true);if(p.data?.length)setSelectedId(p.data[0].id);
   }).catch(()=>setMessage("Não foi possível carregar o banco de dados."));
   return ()=>{alive=false};
 },[]);
 useEffect(()=>{const id=setInterval(()=>setRevision(v=>v+1),60000);return()=>clearInterval(id)},[]);
 const selected=products.find(p=>p.id===selectedId)||products[0];
 const activeAddons=addons.filter(a=>extras.includes(a.id));
 const basePrice=Number(selected?.price||0)+activeAddons.reduce((s,a)=>s+Number(a.price),0);
 const subtotal=cart.reduce((s,c)=>s+c.unit_price*c.quantity,0);
 const area=areas.find(a=>a.id===form.area);
 const delivery=form.fulfillment==="delivery"?Number(area?.fee||0):0;
 const total=subtotal+delivery;
 const open=scheduleOpen(settings);
 const setField=(name,value)=>setForm(f=>({...f,[name]:value}));
 function pickProduct(id){setSelectedId(id);setExtras([]);setMessage("");}
 function toggleExtra(id){setExtras(old=>old.includes(id)?old.filter(x=>x!==id):old.length<(selected?.addons_limit||4)?[...old,id]:old);}
 function addCart(){
   if(!selected)return;
   const line={id:String(Date.now())+"-"+Math.random(),product_id:selected.id,name:selected.name,quantity:1,unit_price:basePrice,addons:activeAddons.map(a=>({id:a.id,name:a.name,price:Number(a.price)}))};
   setCart(prev=>[...prev,line]);setExtras([]);setMessage("Produto adicionado ao pedido.");
 }
 function changeQty(id,diff){setCart(old=>old.map(x=>x.id===id?{...x,quantity:x.quantity+diff}:x).filter(x=>x.quantity>0));}
 async function finish(){
   if(!cart.length){setMessage("Adicione um produto ao pedido.");return;}
   if(!open){setMessage("Pedidos fechados no momento.");return;}
   if(form.name.trim().length<2||form.phone.replace(/\D/g,"").length<10){setMessage("Informe nome e telefone com DDD.");return;}
   if(form.fulfillment==="delivery"&&(!area||form.address.trim().length<6)){setMessage("Escolha o bairro e informe rua e número.");return;}
   setBusy(true);setMessage("");
   const items=cart.map(c=>({product_id:c.product_id,name:c.name,quantity:c.quantity,unit_price:c.unit_price,addons:c.addons}));
   if(backend){
     const {error}=await db.from("orders").insert({customer_name:form.name.trim(),phone:form.phone.trim(),fulfillment:form.fulfillment,delivery_area:form.fulfillment==="delivery"?area.name:null,delivery_address:form.fulfillment==="delivery"?form.address.trim():null,payment_method:form.payment,items,delivery_fee:delivery,total,status:"novo"});
     if(error){setMessage("Não foi possível registrar o pedido. Tente novamente ou entre em contato com a loja.");setBusy(false);return;}
   }
   const lines=[
     "Olá, Açaí Moví! Gostaria de fazer um pedido:",
     ...cart.map(c=>String(c.quantity)+"× "+c.name+" (" + c.addons.map(a=>a.name).join(", ")+") — "+money(c.unit_price*c.quantity)),
     "Subtotal: "+money(subtotal),
     "Entrega: "+(form.fulfillment==="delivery"?area.name+" — "+money(delivery):"Retirada no local"),
     "Total: "+money(total),
     "Nome: "+form.name.trim(),"Telefone: "+form.phone.trim(),
     ...(form.fulfillment==="delivery"?["Endereço: "+form.address.trim()]:[]),
     "Pagamento: "+form.payment
   ];
   const text=lines.join("\n");
   const digits=String(settings.whatsapp_number||"").replace(/\D/g,"");
   try{await navigator.clipboard.writeText(text)}catch{}
   if(digits.length>=12){window.open("https://wa.me/"+digits+"?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");}
   else{window.open("https://wa.me/message/KONPQZAX7CH2L1","_blank","noopener,noreferrer");}
   setMessage(backend?"Pedido registrado! Confirme o atendimento no WhatsApp. Resumo copiado para colar na conversa.":"Modo de demonstração: o pedido NÃO foi salvo. Resumo copiado; envie-o no WhatsApp para solicitar atendimento.");
   if(backend)setCart([]);
   setBusy(false);
 }
 return <main>
  <header className="site-header">
   <div className="wrap">
    <div className="topbar"><div className="brand"><Image src="/logo.png" width={68} height={68} alt="Logotipo Açaí Moví"/><span>Açaí Moví</span></div><span className="tag">Francisco Beltrão • PR</span></div>
    <div className="hero"><span className="tag">{open?"🍇 Aceitando pedidos":"🔒 Pedidos fechados"}</span><h1>Seu açaí, <span>do seu jeito.</span></h1><p>Escolha seu tamanho, monte com seus complementos favoritos e receba em casa ou retire no local.</p></div>
   </div>
  </header>
  <section className="section wrap"><h2>Escolha seu tamanho</h2><p className="muted">Toque no tamanho desejado para começar.</p>
   <div className="catalog">{products.map(p=><button type="button" key={p.id} onClick={()=>pickProduct(p.id)} className={"product "+(selected?.id===p.id?"selected":"")}>
    <div className="photo"><Image src={images[p.size_ml]||"/logo.png"} alt={p.name} fill sizes="(max-width: 520px) 50vw, (max-width: 860px) 45vw, 270px"/></div>
    <div className="product-body"><h3>{p.name}</h3><div className="price">{money(p.price)}</div><p className="small">Até {p.addons_limit} complementos</p></div>
   </button>)}</div>
  </section>
  <section className="section wrap grid-two">
   <div className="panel"><h2>Monte seu açaí</h2><p className="muted">{selected?.name} • {money(basePrice)} • {extras.length}/{selected?.addons_limit||4} complementos</p>
    <div className="addons">{addons.map(a=><button type="button" key={a.id} className={"addon "+(extras.includes(a.id)?"active":"")} onClick={()=>toggleExtra(a.id)} disabled={!extras.includes(a.id)&&extras.length>=(selected?.addons_limit||4)}>
      <span>{extras.includes(a.id)?"✓ ":""}{a.name}</span><span className="pill">{Number(a.price)>0?"+"+money(a.price):"Grátis"}</span>
    </button>)}</div>
    <div style={{marginTop:20}}><button className="btn full" onClick={addCart} disabled={!selected||!open}>Adicionar ao meu pedido • {money(basePrice)}</button></div>
   </div>
   <div className="panel"><h2>Seu pedido</h2>
    {cart.length===0?<div className="empty">Seu carrinho está vazio. Escolha um açaí para começar.</div>:cart.map(c=><div className="cart-item" key={c.id}><div className="line"><strong>{c.name}</strong><b>{money(c.unit_price*c.quantity)}</b></div><p className="small">{c.addons.map(a=>a.name).join(", ")||"Sem adicionais"}</p><div className="qty"><button aria-label="Diminuir quantidade" onClick={()=>changeQty(c.id,-1)}>−</button>{c.quantity}<button aria-label="Aumentar quantidade" onClick={()=>changeQty(c.id,1)}>+</button></div></div>)}
    <hr className="divider"/><h3>Entrega ou retirada</h3>
    <div className="delivery-choices"><label className="radio"><input type="radio" checked={form.fulfillment==="delivery"} onChange={()=>setField("fulfillment","delivery")}/> Entrega</label><label className="radio"><input type="radio" checked={form.fulfillment==="pickup"} onChange={()=>setField("fulfillment","pickup")}/> Retirada</label></div>
    {form.fulfillment==="delivery"&&<><div className="field"><label htmlFor="area">Bairro</label><select id="area" value={form.area} onChange={e=>setField("area",e.target.value)}><option value="">Selecione o bairro</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name} — {money(a.fee)}</option>)}</select></div><div className="field"><label htmlFor="address">Rua, número e complemento</label><input id="address" value={form.address} onChange={e=>setField("address",e.target.value)} placeholder="Ex.: Rua ..., 336, casa"/></div></>}
    <div className="field"><label htmlFor="customer">Nome</label><input id="customer" autoComplete="name" value={form.name} onChange={e=>setField("name",e.target.value)} placeholder="Seu nome"/></div>
    <div className="field"><label htmlFor="phone">WhatsApp com DDD</label><input id="phone" autoComplete="tel" type="tel" value={form.phone} onChange={e=>setField("phone",e.target.value)} placeholder="(46) 99999-9999"/></div>
    <div className="field"><label htmlFor="payment">Pagamento</label><select id="payment" value={form.payment} onChange={e=>setField("payment",e.target.value)}><option>PIX</option><option>Cartão</option><option>Dinheiro</option></select></div>
    <hr className="divider"/>
    <div className="line"><span>Produtos</span><strong>{money(subtotal)}</strong></div><div className="line" style={{marginTop:8}}><span>Entrega</span><strong>{form.fulfillment==="pickup"?money(0):area?money(delivery):"A definir"}</strong></div>
    <div className="line" style={{marginTop:15}}><span>Total</span><span className="total">{money(total)}</span></div>
    <button type="button" className="btn yellow full" style={{marginTop:20}} onClick={finish} disabled={busy||!open||cart.length===0}>{busy?"Processando...":"Finalizar pelo WhatsApp"}</button>
    {message&&<div role="status" className={"status "+(/não|erro|fechados|informe/i.test(message)?"error":"")}>{message}</div>}
    {!backend&&<p className="caption">Versão de testes: pedidos não são registrados no banco enquanto o Supabase não for configurado. Finalize e confirme com a loja pelo WhatsApp.</p>}
   </div>
  </section><footer className="footer"><div className="wrap">Açaí Moví • Feito com carinho em Francisco Beltrão, PR <br/> Preços e disponibilidade sujeitos à confirmação da loja.</div></footer>
 </main>;
}
