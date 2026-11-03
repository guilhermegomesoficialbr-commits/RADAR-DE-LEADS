const $ = (s) => document.querySelector(s);
const state = { leads: [], installPrompt: null, center: null };
const categoryMap = {
  all: null,
  fitness: ['leisure=fitness_centre','leisure=sports_centre'],
  restaurant: ['amenity=restaurant','amenity=cafe','amenity=fast_food','amenity=bar'],
  health: ['amenity=clinic','amenity=doctors','amenity=dentist','healthcare=*'],
  shop: ['shop=*'],
  beauty: ['shop=hairdresser','shop=beauty','beauty=*'],
  realestate: ['office=estate_agent'],
  car: ['shop=car_repair','shop=tyres','craft=car_repair'],
  office: ['office=*']
};
const categoryNames = {fitness:'Academia / esportes',restaurant:'Restaurante / alimentação',health:'Clínica / saúde',shop:'Loja / comércio',beauty:'Beleza',realestate:'Imobiliária',car:'Automotivo',office:'Escritório / serviços',other:'Empresa'};
function setStatus(message, kind='') { const el=$('#status'); el.textContent=message; el.className='status '+kind; }
function clean(s) { return (s||'').trim(); }
function pick(tags, keys) { for(const k of keys){if(tags[k])return tags[k]} return ''; }
function normalizePhone(phone) { return clean(phone).replace(/^tel:/i,''); }
function haversine(a,b) {
  const rad=x=>x*Math.PI/180, dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function getCategory(tags) {
  if(tags.leisure==='fitness_centre'||tags.leisure==='sports_centre') return 'fitness';
  if(['restaurant','cafe','fast_food','bar','food_court'].includes(tags.amenity)) return 'restaurant';
  if(['clinic','doctors','dentist','hospital','pharmacy'].includes(tags.amenity)||tags.healthcare) return 'health';
  if(tags.office==='estate_agent') return 'realestate';
  if(['hairdresser','beauty'].includes(tags.shop)||tags.beauty) return 'beauty';
  if(['car_repair','tyres'].includes(tags.shop)||tags.craft==='car_repair') return 'car';
  if(tags.shop) return 'shop';
  if(tags.office) return 'office';
  return 'other';
}
function matchesCategory(tags, wanted) {
  if(wanted==='all') return true;
  const c=getCategory(tags);
  if(wanted==='office') return c==='office'||c==='realestate';
  return c===wanted;
}
async function lookupCep(cep) {
  const digits=cep.replace(/\D/g,'');
  if(digits.length!==8) throw new Error('Digite um CEP válido com 8 números.');
  const r=await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
  if(!r.ok) throw new Error('Não foi possível localizar esse CEP. Confira os números e tente novamente.');
  const data=await r.json();
  if(typeof data.latitude!=='number'||typeof data.longitude!=='number') {
    // Some CEP records don't have coordinates. Use Nominatim's public geocoder as fallback.
    const q=encodeURIComponent(`${data.street||''}, ${data.neighborhood||''}, ${data.city}, ${data.state}, Brasil`);
    const g=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${q}`);
    const places=await g.json();
    if(!places.length) throw new Error('O CEP foi encontrado, mas não há coordenadas disponíveis para ele.');
    return {lat:+places[0].lat,lon:+places[0].lon,address:[data.street,data.neighborhood,data.city,data.state].filter(Boolean).join(', ')};
  }
  return {lat:data.latitude,lon:data.longitude,address:[data.street,data.neighborhood,data.city,data.state].filter(Boolean).join(', ')};
}
function makeQuery(center, radius, category) {
  const filters=categoryMap[category];
  let selectors=[];
  if(!filters) selectors=['node','way','relation'].map(t=>`${t}(around:${Math.round(radius*1000)},${center.lat},${center.lon})[name]`);
  else {
    for(const f of filters) {
      const [k,v]=f.split('=');
      const val=v==='*'?'':`["${k}"="${v}"]`;
      const wildcard=v==='*'?`["${k}"]`:val;
      for(const t of ['node','way','relation']) selectors.push(`${t}(around:${Math.round(radius*1000)},${center.lat},${center.lon})${wildcard}[name]`);
    }
  }
  return `[out:json][timeout:45];(${selectors.join(';')};);out center tags;`;
}
async function queryOverpass(center, radius, category) {
  const query=makeQuery(center,radius,category);
  const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  let lastError;
  for(const endpoint of endpoints) {
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
      if(!response.ok) throw new Error(`O serviço de mapas respondeu com erro (${response.status}).`);
      return await response.json();
    } catch(e) { lastError=e; }
  }
  throw new Error((lastError?.message||'Falha na consulta')+' Tente novamente mais tarde ou reduza o raio.');
}
function parseLeads(elements, center, radius, category) {
  const seen=new Set(), out=[];
  for(const el of elements||[]) {
    const tags=el.tags||{};
    if(!tags.name||!matchesCategory(tags,category)) continue;
    const lat=el.lat??el.center?.lat, lon=el.lon??el.center?.lon;
    if(typeof lat!=='number'||typeof lon!=='number') continue;
    const distance=haversine(center,{lat,lon});
    if(distance>radius) continue;
    const address=[tags['addr:street'],tags['addr:housenumber'],tags['addr:suburb']||tags['addr:neighbourhood'],tags['addr:city'],tags['addr:state'],tags['addr:postcode']].filter(Boolean).join(', ');
    const phone=normalizePhone(pick(tags,['contact:whatsapp','whatsapp','contact:phone','phone','contact:mobile','mobile']));
    let email=pick(tags,['contact:email','email']);
    let website=pick(tags,['contact:website','website','contact:url','url']);
    if(website && !/^https?:\/\//i.test(website)) website='https://'+website;
    const key=(tags['brand:wikidata']||tags.name).toLowerCase()+'|'+(address||`${lat.toFixed(4)},${lon.toFixed(4)}`).toLowerCase();
    if(seen.has(key)) continue; seen.add(key);
    out.push({name:tags.name,category:getCategory(tags),phone,email,website,address:address||'Endereço não informado no mapa',distance,lat,lon,mapUrl:`https://www.openstreetmap.org/${el.type}/${el.id}`});
  }
  return out.sort((a,b)=>a.distance-b.distance);
}
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function contactLink(phone) {
  const digits=phone.replace(/\D/g,'');
  if(!digits) return '';
  return `<a href="https://wa.me/${digits}" target="_blank" rel="noopener"> ${escapeHtml(phone)} </a>`;
}
function render() {
  const term=$('#filterText').value.toLowerCase().trim(), f=$('#contactFilter').value;
  const rows=state.leads.filter(x=>{
    if(!x.name.toLowerCase().includes(term)) return false;
    if(f==='contact'&&!((x.phone)||(x.email)||(x.website))) return false;
    if(f==='email'&&!x.email) return false;
    if(f==='phone'&&!x.phone) return false;
    if(f==='website'&&!x.website) return false;
    return true;
  });
  $('#summary').textContent=state.leads.length?`${rows.length} exibidos · ${state.leads.length} encontrados`:'Nenhuma busca realizada ainda.';
  $('#csvBtn').disabled=!rows.length; $('#copyBtn').disabled=!rows.length;
  if(!rows.length){$('#leadList').innerHTML=`<div class="empty">${state.leads.length?'Nenhum lead corresponde aos filtros.':'Os resultados aparecerão aqui depois da busca.'}</div>`;return;}
  $('#leadList').innerHTML=rows.map(x=>`<article class="lead-card">
    <div class="lead-top"><div><div class="lead-name">${escapeHtml(x.name)}</div><span class="category">${escapeHtml(categoryNames[x.category]||'Empresa')}</span></div><span class="distance">${x.distance.toFixed(1).replace('.',',')} km</span></div>
    <div class="details">
      <div class="detail"><b>Endereço</b><span>${escapeHtml(x.address)}</span></div>
      <div class="detail"><b>WhatsApp / tel.</b><span>${x.phone?contactLink(x.phone):'Não disponível'}</span></div>
      <div class="detail"><b>E-mail</b><span>${x.email?`<a href="mailto:${escapeHtml(x.email)}">${escapeHtml(x.email)}</a>`:'Não disponível'}</span></div>
      <div class="detail"><b>Site</b><span>${x.website?`<a href="${escapeHtml(x.website)}" target="_blank" rel="noopener">${escapeHtml(x.website)}</a>`:'Não disponível'}</span></div>
      <div class="detail"><b>Mapa / fonte</b><span><a href="${escapeHtml(x.mapUrl)}" target="_blank" rel="noopener">Ver no OpenStreetMap ↗</a></span></div>
    </div></article>`).join('');
}
function visibleRows() {
  const term=$('#filterText').value.toLowerCase().trim(), f=$('#contactFilter').value;
  return state.leads.filter(x=>x.name.toLowerCase().includes(term)&&
    (f!=='contact'||x.phone||x.email||x.website)&&
    (f!=='email'||x.email)&&(f!=='phone'||x.phone)&&(f!=='website'||x.website));
}
function exportCSV() {
  const rows=visibleRows();
  const fields=[['Empresa','name'],['Categoria','category'],['WhatsApp / telefone','phone'],['E-mail','email'],['Site','website'],['Endereço','address'],['Distância (km)','distance'],['Latitude','lat'],['Longitude','lon'],['Fonte','mapUrl']];
  const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv='\uFEFF'+[fields.map(x=>cell(x[0])).join(';'),...rows.map(r=>fields.map(([_,k])=>cell(k==='distance'?r[k].toFixed(2):r[k])).join(';'))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='radar-de-leads.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function search(event) {
  event.preventDefault();
  const btn=$('#searchBtn'); btn.disabled=true; btn.textContent='Buscando empresas...';
  state.leads=[];render();
  try {
    setStatus('Localizando o CEP…');
    const center=await lookupCep($('#cep').value);
    state.center=center;
    setStatus(`Consultando empresas em até ${$('#radius').value} km de ${center.address||'seu CEP'}…`);
    const data=await queryOverpass(center,+$('#radius').value,$('#category').value);
    state.leads=parseLeads(data.elements,center,+$('#radius').value,$('#category').value);
    render();
    setStatus(state.leads.length?`Busca concluída. Encontramos ${state.leads.length} empresas cadastradas na fonte consultada.`:'A consulta terminou, mas não encontrou empresas nessa categoria e raio. Tente aumentar o raio ou mudar a categoria.','success');
  } catch(e) { setStatus(e.message||'Não foi possível concluir a busca. Tente novamente.','error'); }
  finally {btn.disabled=false;btn.innerHTML='⌕ &nbsp; Buscar empresas';}
}
$('#radius').addEventListener('input',()=>$('#radiusValue').textContent=$('#radius').value+' km');
$('#cep').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,8);if(v.length>5)v=v.slice(0,5)+'-'+v.slice(5);e.target.value=v;});
$('#searchForm').addEventListener('submit',search);
$('#filterText').addEventListener('input',render);$('#contactFilter').addEventListener('change',render);
$('#csvBtn').addEventListener('click',exportCSV);
$('#copyBtn').addEventListener('click',async()=>{
  const rows=visibleRows();const header=['Empresa','Categoria','Telefone','E-mail','Site','Endereço','Distância km'];
  const text=[header,...rows.map(x=>[x.name,categoryNames[x.category]||x.category,x.phone,x.email,x.website,x.address,x.distance.toFixed(2)])].map(r=>r.join('\t')).join('\n');
  try{await navigator.clipboard.writeText(text);setStatus('Lista copiada. Você pode colar no Excel ou Google Sheets.','success');}catch(e){setStatus('Seu navegador bloqueou a cópia. Use Exportar CSV / Excel.','error');}
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installBtn').classList.remove('hidden');});
$('#installBtn').addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('#installBtn').classList.add('hidden');});
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
