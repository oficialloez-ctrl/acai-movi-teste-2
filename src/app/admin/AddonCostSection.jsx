"use client";
import { useState } from "react";

const money = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const toNumber = v => {
  if(v===null || v===undefined || String(v).trim()==="")return null;
  const text=String(v).trim().replace(",",".");
  if(!/^\d+(\.\d{1,3})?$/.test(text))return NaN;
  return Number(text);
};
const field = (record,key) => record?.[key] == null ? "" : String(record[key]);
export function portionCost(record){
  const price=toNumber(record?.purchase_price);
  const amount=toNumber(record?.package_quantity);
  const portion=toNumber(record?.portion_quantity);
  if(price===null||amount===null||portion===null||![price,amount,portion].every(Number.isFinite)||price<0||amount<=0||portion<=0)return null;
  return price*portion/amount;
}
export default function AddonCostSection({
  addons,product,costs,setCosts,selection,onSelectionChange,onSaveCost,onSaveSelection,onCreateAddon,onSetAddonVisibility,saving
}){
  const [editing,setEditing]=useState(null);
  const [localError,setLocalError]=useState("");
  const [newAddonName,setNewAddonName]=useState("");
  const [managerBusy,setManagerBusy]=useState(false);
  const [managerNotice,setManagerNotice]=useState("");
  const [managerError,setManagerError]=useState("");
  const [showHidden,setShowHidden]=useState(false);
  const visibleAddons=addons.filter(a=>a.pricing_visible!==false);
  const hiddenAddons=addons.filter(a=>a.pricing_visible===false);
  const selected=selection||[];
  const limit=product?.addons_limit||4;
  function toggle(id){
    setLocalError("");
    if(selected.includes(id)){onSelectionChange(selected.filter(x=>x!==id));return;}
    if(selected.length>=limit){setLocalError("Este produto permite até "+limit+" complementos na simulação.");return;}
    onSelectionChange([...selected,id]);
  }
  function change(id,key,value){
    setCosts(prev=>({...prev,[id]:{...{unit:"g"},...prev[id],[key]:value}}));
  }
  function saveOne(id){
    setLocalError("");
    const item=costs[id]||{};
    const n=[toNumber(item.purchase_price),toNumber(item.package_quantity),toNumber(item.portion_quantity)];
    if(n.some(x=>x===null || !Number.isFinite(x)) || n[0]<0 || n[1]<=0 || n[2]<=0){
      setLocalError("Informe preço pago, quantidade comprada e porção utilizada em valores válidos.");return;
    }
    onSaveCost(id,{purchase_price:n[0],package_quantity:n[1],portion_quantity:n[2],unit:item.unit||"g"})
      .then(ok=>{if(ok)setEditing(null);});
  }
  async function createAddon(){
    const name=newAddonName.trim().replace(/\s+/g," ");
    setManagerNotice("");setManagerError("");
    if(name.length<2||name.length>80){setManagerError("Digite um nome de 2 a 80 caracteres.");return;}
    if(!onCreateAddon){setManagerError("Cadastro indisponível.");return;}
    setManagerBusy(true);
    try{
      const result=await onCreateAddon(name);
      if(result?.ok){
        setNewAddonName("");
        setManagerNotice(result.message||"Complemento cadastrado.");
      }else{
        setManagerError(result?.message||"Não foi possível adicionar o complemento.");
      }
    }catch{setManagerError("Falha de conexão ao cadastrar complemento.");}
    finally{setManagerBusy(false);}
  }
  async function setAddonVisible(addon,visible){
    setManagerNotice("");setManagerError("");
    if(!onSetAddonVisibility){setManagerError("Gerenciamento indisponível.");return;}
    setManagerBusy(true);
    try{
      const result=await onSetAddonVisibility(addon.id,visible);
      if(result?.ok){
        setEditing(null);
        setManagerNotice(result.message||"Lista atualizada.");
      }else{
        setManagerError(result?.message||"Não foi possível alterar a lista.");
      }
    }catch{setManagerError("Falha de conexão ao alterar complemento.");}
    finally{setManagerBusy(false);}
  }
  return <div className="panel">
    <h3>3. Quanto você paga em cada complemento?</h3>
    <p className="small">Informe o valor do pacote, quanto vem nele e quanto usa por porção. O custo é calculado automaticamente. Não confunda o <strong>custo de compra</strong> com o adicional de R$ 3 cobrado do cliente.</p>
    <p className="caption">Exemplo: granola de R$ 20 por 1.000 g, usando 25 g por copo: custo de R$ 0,50 por porção.</p>
    <div className="pricing-management">
      <h4>Gerenciar complementos da precificação</h4>
      <p className="small">Adicione novos itens para calcular custos ou retire os que não utiliza. Retirar <strong>oculta somente nesta aba</strong>, preservando custos anteriores, seleções salvas e o cardápio dos clientes.</p>
      <form className="pricing-management-form" onSubmit={e=>{e.preventDefault();createAddon();}}>
        <label htmlFor="new-pricing-addon">Nome do novo complemento</label>
        <div className="pricing-management-row">
          <input id="new-pricing-addon" maxLength={80} placeholder="Ex.: Creme de pistache" value={newAddonName} onChange={e=>setNewAddonName(e.target.value)}/>
          <button className="btn" type="submit" disabled={managerBusy||!!saving}>{managerBusy?"Salvando...":"+ Adicionar complemento"}</button>
        </div>
      </form>
      <p className="caption">O complemento criado aqui começa desativado no cardápio público. Para disponibilizá-lo aos clientes, ative-o na aba Adicionais e configure o preço de venda.</p>
      {managerNotice&&<div className="status" role="status">{managerNotice}</div>}
      {managerError&&<div className="status error" role="alert">{managerError}</div>}
      {hiddenAddons.length>0&&<div className="pricing-hidden">
        <button className="btn secondary" type="button" onClick={()=>setShowHidden(x=>!x)}>
          {showHidden?"Ocultar removidos":"Ver "+hiddenAddons.length+" removido"+(hiddenAddons.length===1?"":"s")}
        </button>
        {showHidden&&<div className="pricing-hidden-list">
          {hiddenAddons.map(a=><div className="pricing-hidden-item" key={a.id}>
            <span>{a.name}</span>
            <button className="btn secondary" type="button" disabled={managerBusy||!!saving}
              onClick={()=>setAddonVisible(a,true)}>Restaurar</button>
          </div>)}
        </div>}
      </div>}
    </div>
    <div className="addon-cost-grid">{visibleAddons.map(addon=>{
      const record=costs[addon.id]||{};
      const computed=portionCost(record);
      const isEditing=editing===addon.id;
      return <div className="addon-cost-row" key={addon.id}>
        <div className="addon-cost-heading">
          <div className="addon-cost-name"><strong>{addon.name}</strong><small>{computed===null?"Custo ainda não preenchido":money(computed)+" por porção"}</small></div>
          <div className="pricing-addon-actions">
            <button className="btn secondary addon-cost-edit" type="button" onClick={()=>{setEditing(isEditing?null:addon.id);setLocalError("");}}>{isEditing?"Fechar":"Editar custo"}</button>
            <button className="btn secondary addon-cost-edit" type="button" disabled={managerBusy||!!saving}
              title="Retirar somente da lista de precificação, sem excluir do cardápio"
              onClick={()=>setAddonVisible(addon,false)}>Retirar</button>
          </div>
        </div>
        {isEditing&&<div className="addon-cost-form">
          <label>Preço que você pagou pelo pacote (R$)
            <input type="text" inputMode="decimal" placeholder="Ex.: 20,00" value={field(record,"purchase_price")} onChange={e=>change(addon.id,"purchase_price",e.target.value)}/>
          </label>
          <label>Quantidade que veio no pacote
            <input type="text" inputMode="decimal" placeholder="Ex.: 1000" value={field(record,"package_quantity")} onChange={e=>change(addon.id,"package_quantity",e.target.value)}/>
          </label>
          <label>Unidade de medida
            <select value={record.unit||"g"} onChange={e=>change(addon.id,"unit",e.target.value)}>
              <option value="g">Gramas (g)</option><option value="ml">Mililitros (ml)</option><option value="un">Unidades (un)</option>
            </select>
          </label>
          <label>Quantidade usada por porção
            <input type="text" inputMode="decimal" placeholder="Ex.: 25" value={field(record,"portion_quantity")} onChange={e=>change(addon.id,"portion_quantity",e.target.value)}/>
          </label>
          <div className="addon-cost-actions"><span>{computed===null?"Preencha os 3 valores":money(computed)+" por porção"}</span>
            <button className="btn" type="button" disabled={!!saving} onClick={()=>saveOne(addon.id)}>{saving==="addon-"+addon.id?"Salvando...":"Salvar complemento"}</button>
          </div>
        </div>}
      </div>;
    })}{visibleAddons.length===0&&<p className="small">Não há complementos visíveis na precificação. Adicione um novo ou restaure um removido.</p>}</div>
    <hr className="divider"/>
    <h4>Complementos usados para simular {product?.name||"este produto"}</h4>
    <p className="small">Marque os complementos que você quer incluir na simulação deste copo (até {limit}). O custo por porção selecionada substituirá o custo médio manual, evitando cobrança em duplicidade.</p>
    <div className="pricing-selection-grid">{visibleAddons.map(addon=>{
      const cost=portionCost(costs[addon.id]);
      return <label key={addon.id} className={"pricing-selection-item "+(selected.includes(addon.id)?"active":"")}>
        <input type="checkbox" checked={selected.includes(addon.id)} onChange={()=>toggle(addon.id)}
          disabled={!selected.includes(addon.id)&&selected.length>=limit}/>
        <span>{addon.name}<small>{cost===null?"Cadastre o custo":money(cost)+" / porção"}</small></span>
      </label>;
    })}</div>
    <div className="line pricing-selection-footer">
      <span className="small">{selected.length} de {limit} complementos escolhidos</span>
      <button className="btn" disabled={!!saving||!product} onClick={onSaveSelection}>{saving==="selection"?"Salvando...":"Salvar seleção deste copo"}</button>
    </div>
    {localError&&<p className="status error" role="alert">{localError}</p>}
  </div>;
}
