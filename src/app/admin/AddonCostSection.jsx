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
  addons,product,costs,setCosts,selection,onSelectionChange,onSaveCost,onSaveSelection,saving
}){
  const [editing,setEditing]=useState(null);
  const [localError,setLocalError]=useState("");
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
  return <div className="panel">
    <h3>3. Quanto você paga em cada complemento?</h3>
    <p className="small">Informe o valor do pacote, quanto vem nele e quanto usa por porção. O custo é calculado automaticamente. Não confunda o <strong>custo de compra</strong> com o adicional de R$ 3 cobrado do cliente.</p>
    <p className="caption">Exemplo: granola de R$ 20 por 1.000 g, usando 25 g por copo: custo de R$ 0,50 por porção.</p>
    <div className="addon-cost-grid">{addons.map(addon=>{
      const record=costs[addon.id]||{};
      const computed=portionCost(record);
      const isEditing=editing===addon.id;
      return <div className="addon-cost-row" key={addon.id}>
        <div className="addon-cost-heading">
          <div className="addon-cost-name"><strong>{addon.name}</strong><small>{computed===null?"Custo ainda não preenchido":money(computed)+" por porção"}</small></div>
          <button className="btn secondary addon-cost-edit" type="button" onClick={()=>{setEditing(isEditing?null:addon.id);setLocalError("");}}>{isEditing?"Fechar":"Editar custo"}</button>
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
    })}</div>
    <hr className="divider"/>
    <h4>Complementos usados para simular {product?.name||"este produto"}</h4>
    <p className="small">Marque os complementos que você quer incluir na simulação deste copo (até {limit}). O custo por porção selecionada substituirá o custo médio manual, evitando cobrança em duplicidade.</p>
    <div className="pricing-selection-grid">{addons.map(addon=>{
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
