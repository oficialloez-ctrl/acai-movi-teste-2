"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const u=process.env.NEXT_PUBLIC_SUPABASE_URL;
const k=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db=u&&k?createClient(u,k):null;
const days=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);

export default function AdminPage(){
 const [user,setUser]=useState(null),[admin,setAdmin]=useState(false);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [info,setInfo]=useState("");
 const [store,setStore]=useState(null),[orders,setOrders]=useState([]);
 const [products,setProducts]=useState([]),[addons,setAddons]=useState([]),[areas,setAreas]=useState([]);
 const [newName,setNewName]=useState(""),[newPrice,setNewPrice]=useState("");
 const [tab,setTab]=useState("pedidos");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   if(!db)return;
   db.auth.getUser().then(({data})=>setUser(data?.user||null));
   const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
   return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
   if(!db||!user){setAdmin(false);return;}
   let alive=true;
   db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle().then(({data,error})=>{
     if(!alive)return;
     setAdmin(Boolean(data&&!error));
     if(data&&!error)refresh();
   });
   return()=>{alive=false};
 },[user?.id]);
 async function refresh(){
   if(!db)return;
   const [s,o,p,a,z]=await Promise.all([
     db.from("store_settings").select("*").eq("id",1).single(),
     db.from("orders").select("*").order("created_at",{ascending:false}).limit(100),
     db.from("products").select("*").order("sort_order"),
     db.from("addons").select("*").order("sort_order"),
     db.from("delivery_areas").select("*").order("name")
   ]);
   if(s.error||o.error||p.error||a.error||z.error){setInfo("Erro ao carregar dados. Confira o acesso de administrador.");return;}
   setStore(s.data);setOrders(o.data||[]);setProducts(p.data||[]);setAddons(a.data||[]);setAreas(z.data||[]);
 }
 async function login(signUp=false){
   if(!db)return;setBusy(true);setInfo("");
   const res=signUp?await db.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+"/admin"}}):await db.auth.signInWithPassword({email,password});
   setInfo(res.error?res.error.message:signUp?"Conta solicitada. Confirme seu e-mail e peça autorização de administrador.":"Autenticação realizada.");
   setBusy(false);
 }
 async function save(table,row){
   setBusy(true);const changes=table==="orders"?{status:row.status}:row;
   const {error}=await db.from(table).update(changes).eq("id",row.id);
   setInfo(error?error.message:"Alteração salva.");setBusy(false);
   if(!error)refresh();
 }
 async function add(){
   if(!newName.trim()){setInfo("Informe o nome.");return;}
   const value={name:newName.trim(),price:Number(newPrice)||0};
   if(tab==="bairros"){delete value.price;value.fee=Number(newPrice)||0;}
   if(tab==="produtos"){value.size_ml=0;value.addons_limit=4;}
   setBusy(true);
   const {error}=await db.from(tab==="produtos"?"products":tab==="adicionais"?"addons":"delivery_areas").insert(value);
   setInfo(error?error.message:"Item criado.");setBusy(false);
   if(!error){setNewName("");setNewPrice("");refresh();}
 }
 if(!db)return <main className="section wrap"><h1>Painel Açaí Moví</h1><div className="status error">Supabase ainda não configurado. Falta definir NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel.</div><p><a href="/">Voltar à loja</a></p></main>;
 if(!user)return <main className="section wrap" style={{maxWidth:520}}><h1>Painel Açaí Moví</h1><div className="panel"><h2>Entrar</h2><div className="field"><label>E-mail</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Senha</label><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div><button disabled={busy} className="btn" onClick={()=>login()}>Entrar</button> <button disabled={busy} className="btn secondary" onClick={()=>login(true)}>Criar conta</button>{info&&<div className="status">{info}</div>}<p className="caption">O cadastro não concede automaticamente permissão de administrador.</p></div></main>;
 if(!admin)return <main className="section wrap"><h1>Painel Açaí Moví</h1><div className="status">Conta autenticada, mas ainda sem acesso de administrador. Peça ao responsável para cadastrar seu UUID na tabela admin_users do Supabase.<p><code>{user.id}</code></p></div><button className="btn secondary" onClick={()=>db.auth.signOut()}>Sair</button></main>;
 const menu=[["pedidos","Pedidos"],["config","Loja e horários"],["produtos","Produtos"],["adicionais","Adicionais"],["bairros","Bairros"]];
 const rows=tab==="produtos"?products:tab==="adicionais"?addons:areas;
 const changeRow=(id,field,value)=>{const set=tab==="produtos"?setProducts:tab==="adicionais"?setAddons:setAreas;set(old=>old.map(r=>r.id===id?{...r,[field]:value}:r));};
 return <main className="section wrap"><div className="line"><div><h1>Painel administrativo</h1><p className="muted">Açaí Moví • {user.email}</p></div><button className="btn secondary" onClick={()=>db.auth.signOut()}>Sair</button></div>
  <div className="delivery-choices" style={{margin:"24px 0"}}>{menu.map(([id,label])=><button key={id} className={"btn "+(tab===id?"":"secondary")} onClick={()=>{setTab(id);setInfo("");}}>{label}</button>)}</div>
  {info&&<div role="status" className="status">{info}</div>}
  {tab==="config"&&store&&<div className="panel"><h2>Configurações da loja</h2>
   <label className="radio"><input type="checkbox" checked={store.accepting_orders} onChange={e=>setStore({...store,accepting_orders:e.target.checked})}/> Aceitar pedidos (interruptor geral)</label>
   <div className="field"><label>WhatsApp da loja com DDI 55</label><input placeholder="5546999999999" value={store.whatsapp_number||""} onChange={e=>setStore({...store,whatsapp_number:e.target.value})}/></div>
   <div className="grid-two"><div className="field"><label>Abre às</label><input type="time" value={String(store.opening_time||"13:00").slice(0,5)} onChange={e=>setStore({...store,opening_time:e.target.value})}/></div><div className="field"><label>Fecha às</label><input type="time" value={String(store.closing_time||"22:00").slice(0,5)} onChange={e=>setStore({...store,closing_time:e.target.value})}/></div></div>
   <div className="field"><label>Dias de atendimento</label><div className="delivery-choices">{days.map((name,day)=><label className="radio" key={day}><input type="checkbox" checked={(store.open_days||[]).includes(day)} onChange={e=>setStore({...store,open_days:e.target.checked?[...(store.open_days||[]),day].sort():(store.open_days||[]).filter(x=>x!==day)})}/>{name}</label>)}</div></div>
   <p className="caption">Fuso: America/Sao_Paulo. Desative o interruptor para fechar a loja imediatamente.</p>
   <button className="btn" disabled={busy} onClick={()=>save("store_settings",{...store,updated_at:new Date().toISOString()})}>Salvar configurações</button>
  </div>}
  {tab==="pedidos"&&<div className="panel"><div className="line"><h2>Pedidos recentes</h2><button className="btn secondary" onClick={refresh}>Atualizar</button></div>{orders.length===0?<p className="empty">Nenhum pedido registrado ainda.</p>:orders.map(o=><div className="cart-item" key={o.id}>
   <div className="line"><strong>{o.customer_name} • {money(o.total)}</strong><small>{new Date(o.created_at).toLocaleString("pt-BR")}</small></div>
   <p className="small">{o.phone} • {o.fulfillment==="delivery"?(o.delivery_area+" — "+o.delivery_address):"Retirada"} • {o.payment_method}</p>
   <p className="small">{(o.items||[]).map(i=>i.quantity+"× "+i.name).join(" · ")}</p>
   <div className="line"><select aria-label="Status do pedido" value={o.status} onChange={e=>setOrders(old=>old.map(x=>x.id===o.id?{...x,status:e.target.value}:x))}>{["novo","confirmado","preparando","saiu_para_entrega","finalizado","cancelado"].map(x=><option key={x} value={x}>{x}</option>)}</select><button disabled={busy} className="btn secondary" onClick={()=>save("orders",o)}>Salvar status</button></div>
  </div>)}</div>}
  {["produtos","adicionais","bairros"].includes(tab)&&<div className="panel"><h2>{menu.find(m=>m[0]===tab)?.[1]}</h2><p className="caption">Produtos e complementos desativados deixam de aparecer no cardápio; pedidos anteriores permanecem registrados.</p>
    {rows.map(r=><div className="cart-item" key={r.id}><div className="grid-two"><div className="field"><label>Nome</label><input value={r.name} onChange={e=>changeRow(r.id,"name",e.target.value)}/></div><div className="field"><label>Valor (R$)</label><input type="number" min="0" step=".01" value={tab==="bairros"?r.fee:r.price} onChange={e=>changeRow(r.id,tab==="bairros"?"fee":"price",e.target.value)}/></div></div>
    <div className="line"><label className="radio"><input type="checkbox" checked={r.is_active} onChange={e=>changeRow(r.id,"is_active",e.target.checked)}/> Ativo</label><button disabled={busy} className="btn secondary" onClick={()=>save(tab==="produtos"?"products":tab==="adicionais"?"addons":"delivery_areas",r)}>Salvar</button></div>
    </div>)}
    <hr className="divider"/><h3>Novo item</h3><div className="grid-two"><div className="field"><label>Nome</label><input value={newName} onChange={e=>setNewName(e.target.value)}/></div><div className="field"><label>Valor (R$)</label><input type="number" min="0" step=".01" value={newPrice} onChange={e=>setNewPrice(e.target.value)}/></div></div><button className="btn" disabled={busy} onClick={add}>Adicionar</button>
  </div>}
  <p className="caption">Alterações são gravadas no Supabase. Evite abrir pedidos reais antes de testar todas as operações.</p>
 </main>;
}
