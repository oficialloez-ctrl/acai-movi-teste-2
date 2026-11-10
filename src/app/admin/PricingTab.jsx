"use client";
import { useEffect, useMemo, useState } from "react";
import AddonCostSection, { portionCost } from "./AddonCostSection";

const REAL = new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"});
const money = n => Number.isFinite(n) ? REAL.format(n) : "—";
const emptyProfile = {acai_grams:"", toppings_cost:"", packaging_cost:"", other_unit_cost:"0"};
const initialSettings = {
  acai_cost_per_kg:"", fixed_monthly_expenses:"", expected_monthly_cups:"",
  payment_fee_percent:"0", acai_waste_percent:"0", desired_margin_percent:"30"
};
const numeric = text => {
  if (text === null || text === undefined || String(text).trim() === "") return null;
  const raw = String(text).trim().replace(/\s/g,"").replace(",",".");
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) return NaN;
  return Number(raw);
};
const asInput = value => value == null ? "" : String(value);
const toDraft = record => ({
  acai_grams:asInput(record?.acai_grams),
  toppings_cost:asInput(record?.toppings_cost),
  packaging_cost:asInput(record?.packaging_cost),
  other_unit_cost:asInput(record?.other_unit_cost ?? 0)
});
const roundUp50 = value => Math.ceil((value - 0.0000001)*2)/2;

function calculate(settings, draft, product, addonPortions=[]){
  const costKg=numeric(settings.acai_cost_per_kg);
  const fixed=numeric(settings.fixed_monthly_expenses);
  const units=numeric(settings.expected_monthly_cups);
  const fee=numeric(settings.payment_fee_percent);
  const loss=numeric(settings.acai_waste_percent);
  const margin=numeric(settings.desired_margin_percent);
  const grams=numeric(draft.acai_grams);
  const detailed=addonPortions.length>0;
  const toppings=detailed
    ? addonPortions.reduce((sum,a)=>sum+(a.cost||0),0)
    : numeric(draft.toppings_cost);
  const packing=numeric(draft.packaging_cost);
  const other=numeric(draft.other_unit_cost);
  const needed=[];
  if(costKg===null) needed.push("custo do açaí por kg");
  if(fixed===null) needed.push("despesas fixas mensais (use 0 se não houver)");
  if(fixed>0 && (units===null || units<=0)) needed.push("previsão de copos vendidos por mês");
  if(grams===null) needed.push("gramas de açaí por unidade");
  if(detailed && addonPortions.some(a=>a.cost===null)) needed.push("preço, quantidade de compra e porção de todos os complementos selecionados");
  if(toppings===null) needed.push("custo médio dos complementos ou seleção detalhada de complementos");
  if(packing===null) needed.push("custo de embalagem");
  if(needed.length)return {ready:false,reason:"Preencha: "+needed.join(", ")+".",needed};
  if([costKg,fixed,fee,loss,margin,grams,toppings,packing,other].some(n=>n===null || !Number.isFinite(n) || n<0)
    || (fixed>0 && (!Number.isFinite(units) || units<=0))
    || grams<=0 || fee>=100 || loss>=100 || margin>=90)
    return {ready:false,reason:"Confira os números: valores não podem ser negativos, as gramas devem ser maiores que zero e os percentuais precisam ser válidos."};
  const acai=(costKg*grams)/1000;
  const desperdicio=acai*loss/100;
  const fixo=fixed===0?0:fixed/units;
  const total=acai+desperdicio+toppings+packing+other+fixo;
  const current=Number(product?.price);
  const rate=fee/100;
  const currentProfit=Number.isFinite(current) && current>0 ? current*(1-rate)-total : null;
  const currentMargin=currentProfit===null?null:currentProfit/current*100;
  const breakEven= total/(1-rate);
  const suggestion=rate+margin/100<1?roundUp50(total/(1-rate-margin/100)):null;
  return {ready:true,acai,desperdicio,fixo,total,toppings,detailed,fee,margin,current,currentProfit,currentMargin,breakEven,suggestion,
    scenarios:[25,35,45].map(m=>({margin:m,price:rate+m/100<1?roundUp50(total/(1-rate-m/100)):null}))};
}
function Field({id,label,value,onChange,placeholder,helper,unit="R$"}){
  return <div className="field pricing-field">
    <label htmlFor={id}>{label}</label>
    <div className="pricing-input-row">
      <span aria-hidden="true">{unit}</span>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder||"0,00"}
        value={value ?? ""} onChange={e=>onChange(e.target.value)} />
    </div>
    {helper&&<small className="caption">{helper}</small>}
  </div>;
}

export default function PricingTab({db,products=[],addons=[],onCreateAddon,onSetAddonVisibility}){
  const [settings,setSettings]=useState(initialSettings);
  const [drafts,setDrafts]=useState({});
  const [addonCosts,setAddonCosts]=useState({});
  const [productSelections,setProductSelections]=useState({});
  const [adjustPercent,setAdjustPercent]=useState(0);
  const [selectedId,setSelectedId]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const selectedProduct=products.find(p=>p.id===selectedId) || products[0];
  const draft=drafts[selectedProduct?.id] || emptyProfile;
  const selectedAddons=(productSelections[selectedProduct?.id]||[]).filter(id=>addons.some(a=>a.id===id&&a.pricing_visible!==false));
  const detailedAddons=useMemo(()=>selectedAddons.map(id=>({
    id,
    name:addons.find(a=>a.id===id)?.name||"Complemento",
    cost:portionCost(addonCosts[id])
  })),[selectedAddons,addons,addonCosts]);
  const calc=useMemo(()=>calculate(settings,draft,selectedProduct,detailedAddons),[settings,draft,selectedProduct,detailedAddons]);
  const adjustedPrice=calc.ready&&calc.suggestion!==null?Math.max(0.5,Math.round(calc.suggestion*(1+adjustPercent/100)*2)/2):null;
  const adjustedProfit=adjustedPrice===null?null:adjustedPrice*(1-calc.fee/100)-calc.total;
  const adjustedMargin=adjustedPrice===null?null:100*adjustedProfit/adjustedPrice;

  useEffect(()=>{
    if(!db){setError("A conexão com o Supabase não está disponível.");setLoading(false);return;}
    let alive=true;
    async function load(){
      const [s,p,c,selected]=await Promise.all([
        db.from("pricing_settings").select("*").eq("id",1).single(),
        db.from("product_pricing").select("*"),
        db.from("addon_costs").select("*"),
        db.from("pricing_product_addons").select("*")
      ]);
      if(!alive)return;
      if(s.error||p.error||c.error||selected.error){
        setError("Não foi possível carregar a precificação. Confira as permissões e as tabelas no Supabase.");
      }else{
        setSettings({
          acai_cost_per_kg:asInput(s.data.acai_cost_per_kg),
          fixed_monthly_expenses:asInput(s.data.fixed_monthly_expenses),
          expected_monthly_cups:asInput(s.data.expected_monthly_cups),
          payment_fee_percent:asInput(s.data.payment_fee_percent),
          acai_waste_percent:asInput(s.data.acai_waste_percent),
          desired_margin_percent:asInput(s.data.desired_margin_percent)
        });
        const map={};
        for(const row of p.data||[])map[row.product_id]=toDraft(row);
        setDrafts(map);
        const byAddon={};
        for(const row of c.data||[])byAddon[row.addon_id]={
          purchase_price:asInput(row.purchase_price),
          package_quantity:asInput(row.package_quantity),
          portion_quantity:asInput(row.portion_quantity),
          unit:row.unit||"g"
        };
        setAddonCosts(byAddon);
        const selections={};
        for(const row of selected.data||[])selections[row.product_id]=row.addon_ids||[];
        setProductSelections(selections);
      }
      setLoading(false);
    }
    load();
    return ()=>{alive=false};
  },[db]);

  function changeSetting(key,value){
    setSettings(old=>({...old,[key]:value}));
    setNotice("");setError("");
  }
  function changeDraft(key,value){
    if(!selectedProduct)return;
    setDrafts(old=>({...old,[selectedProduct.id]:{...emptyProfile,...old[selectedProduct.id],[key]:value}}));
    setNotice("");setError("");
  }
  function updateSelection(ids){
    if(!selectedProduct)return;
    setProductSelections(old=>({...old,[selectedProduct.id]:ids}));
    setNotice("");setError("");
  }
  async function saveAddonCost(id,values){
    setNotice("");setError("");setSaving("addon-"+id);
    const {error:err}=await db.from("addon_costs").upsert({
      addon_id:id,...values,updated_at:new Date().toISOString()
    },{onConflict:"addon_id"});
    setSaving("");
    if(err){setError("Erro ao salvar complemento: "+err.message);return false;}
    setNotice("Custo do complemento salvo. Preços de venda permanecem inalterados.");
    return true;
  }
  async function saveSelection(){
    if(!selectedProduct)return;
    setNotice("");setError("");
    const ids=selectedAddons;
    if(ids.length>selectedProduct.addons_limit||ids.some(id=>!addons.some(a=>a.id===id))){
      setError("Seleção de complementos inválida.");return;
    }
    setSaving("selection");
    const {error:err}=await db.from("pricing_product_addons").upsert({
      product_id:selectedProduct.id,addon_ids:ids,updated_at:new Date().toISOString()
    },{onConflict:"product_id"});
    setSaving("");
    if(err){setError("Não foi possível salvar a seleção: "+err.message);return;}
    setNotice("Complementos usados na simulação salvos para "+selectedProduct.name+".");
  }
  function validate(values,limits){
    const parsed={};
    for(const [key,range] of Object.entries(limits)){
      const n=numeric(values[key]);
      if(Number.isNaN(n)||(n!==null && (n<range.min || n>range.max || (range.integer&&!Number.isInteger(n)))))
        return {error:"Valor inválido em "+range.label+"."};
      if(range.required && n===null)return {error:"Preencha "+range.label+"."};
      parsed[key]=n;
    }
    return {parsed};
  }
  async function saveSettings(){
    setNotice("");setError("");
    const checks={
      acai_cost_per_kg:{min:0,max:100000,label:"custo do açaí por kg"},
      fixed_monthly_expenses:{min:0,max:10000000,label:"despesas fixas"},
      expected_monthly_cups:{min:1,max:10000000,integer:true,label:"copos por mês"},
      payment_fee_percent:{min:0,max:99.9,required:true,label:"taxa de pagamento"},
      acai_waste_percent:{min:0,max:99.9,required:true,label:"desperdício"},
      desired_margin_percent:{min:0,max:89.9,required:true,label:"margem desejada"}
    };
    const v=validate(settings,checks);
    if(v.error){setError(v.error);return;}
    if(v.parsed.fixed_monthly_expenses>0 && !v.parsed.expected_monthly_cups){setError("Informe quantos copos pretende vender por mês para ratear as despesas fixas.");return;}
    if(v.parsed.desired_margin_percent+v.parsed.payment_fee_percent>=100){setError("A soma da margem desejada e das taxas precisa ser inferior a 100%.");return;}
    setSaving("settings");
    const {error:err}=await db.from("pricing_settings").update({...v.parsed,updated_at:new Date().toISOString()}).eq("id",1);
    setSaving("");
    if(err){setError("Não foi possível salvar: "+err.message);return;}
    setNotice("Parâmetros gerais salvos. Nenhum preço do cardápio foi alterado.");
  }
  async function saveProfile(){
    if(!selectedProduct)return;
    setNotice("");setError("");
    const v=validate(draft,{
      acai_grams:{min:0.01,max:5000,label:"gramas por unidade"},
      toppings_cost:{min:0,max:100000,label:"complementos"},
      packaging_cost:{min:0,max:100000,label:"embalagem"},
      other_unit_cost:{min:0,max:100000,required:true,label:"outros custos"}
    });
    if(v.error){setError(v.error);return;}
    setSaving("profile");
    const {error:err}=await db.from("product_pricing").upsert({
      product_id:selectedProduct.id,...v.parsed,updated_at:new Date().toISOString()
    },{onConflict:"product_id"});
    setSaving("");
    if(err){setError("Não foi possível salvar: "+err.message);return;}
    setNotice("Custos de "+selectedProduct.name+" salvos. O preço de venda continua inalterado.");
  }
  if(loading)return <div className="panel"><h2>Precificação</h2><p>Carregando parâmetros de custos...</p></div>;
  return <div className="pricing-stack">
    <div className="panel">
      <div className="line" style={{alignItems:"flex-start"}}>
        <div><h2>Simulador de precificação</h2><p className="muted">Descubra quanto custa produzir cada copo e qual preço pode atingir a margem desejada.</p></div>
        <span className="pricing-privacy">Privado • ADM</span>
      </div>
      <p className="status">As simulações são para análise. <strong>Salvar custos não modifica os preços da loja.</strong> Use seus valores reais de compra para resultados confiáveis.</p>
      {error&&<p role="alert" className="status error">{error}</p>}
      {notice&&<p role="status" className="status">{notice}</p>}
    </div>
    <div className="panel">
      <h3>1. Custos gerais da operação</h3>
      <p className="small">Estes parâmetros são compartilhados entre os tamanhos. Preencha zero somente quando o custo for realmente zero.</p>
      <div className="pricing-fields">
        <Field id="p-acai" label="Quanto custa 1 kg de açaí?" value={settings.acai_cost_per_kg}
          onChange={v=>changeSetting("acai_cost_per_kg",v)} helper="Preço da matéria-prima por kg." />
        <Field id="p-fixed" label="Despesas fixas mensais" value={settings.fixed_monthly_expenses}
          onChange={v=>changeSetting("fixed_monthly_expenses",v)}
          helper="Aluguel, energia, internet, salários fixos etc. Coloque 0 caso não deseje ratear." />
        <Field id="p-volume" label="Previsão de vendas mensais" unit="un." placeholder="Ex.: 300"
          value={settings.expected_monthly_cups} onChange={v=>changeSetting("expected_monthly_cups",v)}
          helper="Quantidade total de unidades vendidas no mês. Necessária se houver despesas fixas." />
        <Field id="p-fees" label="Taxas sobre a venda" unit="%" value={settings.payment_fee_percent}
          onChange={v=>changeSetting("payment_fee_percent",v)}
          helper="Ex.: taxa média da maquininha. Se usar PIX sem taxa, informe 0." />
        <Field id="p-waste" label="Perda/desperdício do açaí" unit="%" value={settings.acai_waste_percent}
          onChange={v=>changeSetting("acai_waste_percent",v)}
          helper="Percentual extra sobre o custo do açaí usado por unidade." />
        <Field id="p-margin" label="Margem estimada desejada" unit="%" value={settings.desired_margin_percent}
          onChange={v=>changeSetting("desired_margin_percent",v)}
          helper="Meta de margem após os custos, rateio de despesas fixas e taxas. Inicial: 30% (ajustável)." />
      </div>
      <div className="pricing-regulator">
        <div className="line"><label htmlFor="pricing-margin-slider"><strong>Regulador de margem</strong></label><strong>{settings.desired_margin_percent||"0"}%</strong></div>
        <div className="pricing-slider-controls">
          <button type="button" className="btn secondary" aria-label="Diminuir margem em 1%" onClick={()=>changeSetting("desired_margin_percent",String(Math.max(0,(Number(settings.desired_margin_percent)||0)-1)))}>−</button>
          <input id="pricing-margin-slider" type="range" min="0" max="80" step="1" value={Math.min(80,Math.max(0,Number(settings.desired_margin_percent)||0))} onChange={e=>changeSetting("desired_margin_percent",e.target.value)}/>
          <button type="button" className="btn secondary" aria-label="Aumentar margem em 1%" onClick={()=>changeSetting("desired_margin_percent",String(Math.min(80,(Number(settings.desired_margin_percent)||0)+1)))}>+</button>
        </div>
        <p className="caption">Arraste para aumentar ou diminuir a margem desejada; o cálculo é atualizado na hora. Clique em salvar para guardar essa meta.</p>
      </div>
      <button className="btn" disabled={!!saving} onClick={saveSettings}>{saving==="settings"?"Salvando...":"Salvar custos gerais"}</button>
    </div>
    <div className="panel">
      <h3>2. Custo por tamanho</h3>
      <div className="field pricing-select">
        <label htmlFor="pricing-product">Selecione o copo ou produto</label>
        <select id="pricing-product" value={selectedProduct?.id||""}
          onChange={e=>{setSelectedId(e.target.value);setNotice("");setError("");}}>
          {products.map(p=><option key={p.id} value={p.id}>{p.name} — preço atual {money(Number(p.price))}</option>)}
        </select>
      </div>
      {selectedProduct?<><div className="pricing-fields">
        <Field id="p-grams" unit="g" label="Quantidade de açaí na unidade"
          value={draft.acai_grams} onChange={v=>changeDraft("acai_grams",v)}
          helper="Informe gramas de açaí utilizadas, não a capacidade do copo em ml." />
        <Field id="p-toppings" label="Custo médio manual dos complementos" value={draft.toppings_cost}
          onChange={v=>changeDraft("toppings_cost",v)}
          helper={"Usado somente se não houver complementos selecionados abaixo, para evitar custo duplicado."} />
        <Field id="p-package" label="Copo, tampa, colher e embalagem" value={draft.packaging_cost}
          onChange={v=>changeDraft("packaging_cost",v)}
          helper="Some o custo do copo, tampa, colher, etiqueta, sacola etc." />
        <Field id="p-other" label="Outros custos variáveis da unidade" value={draft.other_unit_cost}
          onChange={v=>changeDraft("other_unit_cost",v)}
          helper="Ex.: custos adicionais de produção não lançados acima; 0 se não houver." />
      </div>
      <button className="btn" disabled={!!saving} onClick={saveProfile}>{saving==="profile"?"Salvando...":"Salvar custos desta unidade"}</button></>
      :<p className="small">Cadastre um produto na aba Produtos antes de usar o simulador.</p>}
    </div>
    <AddonCostSection addons={addons} product={selectedProduct}
      costs={addonCosts} setCosts={setAddonCosts} selection={selectedAddons}
      onSelectionChange={updateSelection} onSaveCost={saveAddonCost}
      onCreateAddon={onCreateAddon} onSetAddonVisibility={onSetAddonVisibility}
      onSaveSelection={saveSelection} saving={saving}/>
    {selectedProduct&&<div className="panel">
      <h3>4. Resultado da simulação</h3>
      {!calc.ready?<div className="status">{calc.reason}</div>:<>
        <div className="pricing-kpis">
          <div className="pricing-kpi"><span>Custo estimado por unidade</span><strong>{money(calc.total)}</strong></div>
          <div className="pricing-kpi"><span>Preço atual no cardápio</span><strong>{money(calc.current)}</strong></div>
          <div className="pricing-kpi"><span>Resultado no preço atual</span>
            <strong className={calc.currentProfit<0?"pricing-negative":""}>{money(calc.currentProfit)}</strong>
            <small>{Number.isFinite(calc.currentMargin)?calc.currentMargin.toFixed(1).replace(".",",")+"% de margem estimada":"—"}</small>
          </div>
          <div className="pricing-kpi pricing-highlight"><span>Preço sugerido para {settings.desired_margin_percent}% de margem</span>
            <strong>{calc.suggestion===null?"Inviável":money(calc.suggestion)}</strong>
            <small>Arredondado para cima, em intervalos de R$ 0,50.</small>
          </div>
        </div>
        <div className="pricing-breakdown">
          <div className="line"><span>Açaí utilizado</span><strong>{money(calc.acai)}</strong></div>
          <div className="line"><span>Perdas do açaí</span><strong>{money(calc.desperdicio)}</strong></div>
          <div className="line"><span>Complementos {calc.detailed?"(selecionados)":"(média manual)"}</span><strong>{money(calc.toppings)}</strong></div>
          <div className="line"><span>Embalagem</span><strong>{money(numeric(draft.packaging_cost))}</strong></div>
          <div className="line"><span>Outros custos variáveis</span><strong>{money(numeric(draft.other_unit_cost))}</strong></div>
          <div className="line"><span>Rateio das despesas fixas</span><strong>{money(calc.fixo)}</strong></div>
          <div className="line pricing-total"><strong>Custo unitário estimado</strong><strong>{money(calc.total)}</strong></div>
          <div className="line"><span>Preço mínimo de equilíbrio, considerando taxa de {settings.payment_fee_percent}%</span><strong>{money(calc.breakEven)}</strong></div>
        </div>
        <div className="pricing-regulator">
          <div className="line"><label htmlFor="pricing-adjust-slider"><strong>Ajuste de preço para cima ou para baixo</strong></label><strong>{adjustPercent>0?"+":""}{adjustPercent}%</strong></div>
          <div className="pricing-slider-controls">
            <button type="button" className="btn secondary" aria-label="Reduzir preço em 5 pontos percentuais" onClick={()=>setAdjustPercent(v=>Math.max(-40,v-5))}>−</button>
            <input id="pricing-adjust-slider" type="range" min="-40" max="50" step="5" value={adjustPercent} onChange={e=>setAdjustPercent(Number(e.target.value))}/>
            <button type="button" className="btn secondary" aria-label="Aumentar preço em 5 pontos percentuais" onClick={()=>setAdjustPercent(v=>Math.min(50,v+5))}>+</button>
          </div>
          <div className="pricing-kpis pricing-adjusted">
            <div className="pricing-kpi"><span>Preço simulado após ajuste</span><strong>{adjustedPrice===null?"Inviável":money(adjustedPrice)}</strong></div>
            <div className="pricing-kpi"><span>Resultado estimado por unidade</span><strong className={adjustedProfit<0?"pricing-negative":""}>{adjustedProfit===null?"—":money(adjustedProfit)}</strong>
              <small>Margem após ajuste: {adjustedMargin===null?"—":adjustedMargin.toFixed(1).replace(".",",")+"%"}</small></div>
          </div>
          {adjustedProfit!==null&&adjustedProfit<0&&<p className="status error">Atenção: este ajuste gera perda estimada por unidade.</p>}
          <p className="caption">Ajusta o preço sugerido de −40% a +50% sem alterar o preço cadastrado na loja. O valor mostrado é arredondado para R$ 0,50 mais próximo.</p>
        </div>
        <h4>Outros cenários de margem</h4>
        <div className="pricing-scenarios">{calc.scenarios.map(s=><div key={s.margin}><span>Margem de {s.margin}%</span><strong>{s.price===null?"Inviável":money(s.price)}</strong></div>)}</div>
        <p className="caption" style={{marginTop:18}}>O resultado considera somente os custos informados, o rateio mensal e as taxas configuradas. Tributos, frete subsidiado, promoções e outras despesas precisam ser incluídos nos campos adequados para uma estimativa mais fiel. A margem calculada não é lucro líquido contábil.</p>
      </>}
    </div>}
  </div>;
}
