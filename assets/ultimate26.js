(()=>{'use strict';
const KEY='fz26_extras_v1', $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=['Zwykły','Niepospolity','Rzadki','Epicki','Legendarny','Mityczny','Sekretny'], colors=['#9da7b4','#54d88a','#63a8ff','#c08bff','#ffd45e','#ff749e','#60f2ee'];
const creatures=['Lis','Smok','Kot','Wilk','Feniks','Panda','Tygrys','Żółw','Sokół','Lew','Aksolotl','Królik','Gryf','Sowa','Rekin','Jednorożec','Niedźwiedź','Lisek','Pantera','Jeleń'];
const themes=['Ognisty','Lodowy','Kosmiczny','Złoty','Leśny','Burzowy','Morski','Kryształowy','Cienisty','Słoneczny','Neonowy','Królewski'];
const eggTypes=[{n:'Zwykłe',e:'🥚',cost:100,w:[45,27,15,8,4,0.9,0.1]},{n:'Złote',e:'🌟',cost:350,w:[15,25,27,18,11,3.5,.5]},{n:'Smocze',e:'🐉',cost:600,w:[8,20,25,25,15,6,1]},{n:'Kosmiczne',e:'🌌',cost:850,w:[5,15,24,26,20,8,2]},{n:'Mityczne',e:'💎',cost:1400,w:[0,5,15,30,30,16,4]},{n:'Eventowe',e:'🎉',cost:700,w:[10,18,25,25,15,6,1]}];
const events=['Mundial','EURO','Finał Ligi Mistrzów','Igrzyska Olimpijskie','MŚ w siatkówce','MŚ w koszykówce','Finały NBA','MŚ w piłce ręcznej','Finał sezonu F1','Mistrzostwa esportowe','Boże Narodzenie','Halloween','Wielkanoc','Sylwester','Walentynki','Wakacje','Black Friday','Rocznica SPORTIVRA','Turniej Czterech Skoczni','Pierwszy dzień wiosny','Nowy Rok'];
const allPets=Array.from({length:1200},(_,i)=>({id:i+1,name:`${themes[Math.floor(i/20)%themes.length]} ${creatures[i%20]} ${String(i+1).padStart(4,'0')}`,tier:Math.min(6,Math.floor(i/172)),emoji:['🦊','🐉','🐈','🐺','🐦','🐼','🐯','🐢','🦅','🦁','🦎','🐰','🦄','🦉','🦈'][i%15]}));
const petImage=id=>'assets/pets/'+String(id).padStart(4,'0')+'.svg';
const newState=()=>({coins:1000,owned:[],shiny:[],levels:{},decor:[],titles:[],badges:[],friends:[],clubs:[],notices:[],daily:{},pass:0,arcade:0,claimed:[],lastLogin:'',streak:0,birthday:'',promo:[],voted:{},history:[]});
let state;try{state={...newState(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state=newState()}
// Keep older local collections available for the reviewed migration. Never render a
// previous account's cached wallet or inventory before the current session loads.
try{const old=localStorage.getItem(KEY);if(old&&!localStorage.getItem('fz26_legacy_before_cloud_v1'))localStorage.setItem('fz26_legacy_before_cloud_v1',old)}catch{}
function clearCloudState(){state.coins=0;state.pass=0;state.claimed=[];state.owned=[];state.petCounts={};state.eventPets={};state.decor=[];state.shiny=[];state.levels={};state.daily=Object.fromEntries(Object.entries(state.daily||{}).filter(([key])=>!key.endsWith(':login')));}
clearCloudState();
// Exact inventory counts are kept separately: no 100-copy truncation.
state.petCounts=state.petCounts||{};
state.eventPets=state.eventPets||{};

// Secure cloud adapter. Does not upload local coins or pet rewards to server.
const CLOUD_URL=window.SPORTIVRA_CONFIG.supabaseUrl;
const CLOUD_KEY=window.SPORTIVRA_CONFIG.supabasePublishableKey;
let cloudDb=null,cloudReady=false,cloudUser=null,cloudLoading=false,cloudRetry=false,cloudGeneration=0,cloudError='Zaloguj się, aby używać bezpiecznych nagród';
async function cloudInit(){if(cloudLoading){cloudRetry=true;return}cloudLoading=true;const generation=cloudGeneration;try{
 if(!window.supabase?.createClient)return;
 if(!cloudDb){
  cloudDb=window.supabase.createClient(CLOUD_URL,CLOUD_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  cloudDb.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||(event==='SIGNED_IN'&&cloudUser?.id!==session?.user?.id)){
    cloudGeneration++;cloudReady=false;cloudUser=null;cloudError='Zaloguj się';clearCloudState();
    if($('#fz26-overlay'))render();
    if(event==='SIGNED_IN')setTimeout(()=>cloudInit(),0);
   }
  });
 }
 const {data:{user},error}=await cloudDb.auth.getUser();if(generation!==cloudGeneration)return;if(error||!user){cloudReady=false;cloudUser=null;cloudError='Zaloguj się';clearCloudState();if($('#fz26-overlay'))render();return;}
 cloudUser=user;
 // The RPC is optional on older installations. SQL 17 awards each active login mission once.
 const auto=await cloudDb.rpc('fz26_claim_active_event_logins');
 if(auto.error && auto.error.code!=='PGRST202')console.warn('Event login rewards:',auto.error.message);
 const {data,error:e}=await cloudDb.rpc('fz26_bootstrap');if(e)throw e;
 // Supabase REST defaults to a limited page. Read every inventory page.
 const items=[];const PAGE=500;let offset=0;
 while(true){
  const {data:part,error:ie}=await cloudDb.from('fz26_inventory').select('item_type,item_id,quantity').order('item_type').order('item_id').range(offset,offset+PAGE-1);
  if(ie)throw ie;items.push(...(part||[]));
  if(!part||part.length<PAGE)break;
  offset+=PAGE;if(offset>20000)throw Error('Zbyt duży ekwipunek — przerwano odczyt');
 }
 const {data:passClaims,error:pe}=await cloudDb.from('fz26_pass_claims').select('level');if(pe)throw pe;
 if(generation!==cloudGeneration)return;
 state.coins=data.coins;state.pass=data.xp;
 // Daily button follows the account's server-side claim, not another account's local cache.
 state.daily[today()+':login']=data.last_daily===today();
 state.claimed=(passClaims||[]).map(x=>x.level);
 state.petCounts=Object.fromEntries(items.filter(x=>x.item_type==='pet' && /^(?:[1-9]\d{0,2}|1[01]\d{2}|1200)$/.test(x.item_id)).map(x=>[String(x.item_id),Math.max(0,Number(x.quantity)||0)]));
 state.eventPets=Object.fromEntries(items.filter(x=>x.item_type==='pet' && !/^(?:[1-9]\d{0,2}|1[01]\d{2}|1200)$/.test(x.item_id) && Number(x.quantity)>0).map(x=>[String(x.item_id),Number(x.quantity)]));
 state.owned=Object.keys(state.petCounts).filter(id=>state.petCounts[id]>0).map(Number);
 state.decor=items.filter(x=>x.item_type==='decor').map(x=>x.item_id);
 state.shiny=items.filter(x=>x.item_type==='pet_shiny').map(x=>Number(x.item_id));
 state.levels=Object.fromEntries(items.filter(x=>x.item_type==='pet_level').map(x=>[x.item_id,x.quantity]));
 cloudReady=true;cloudError='Synchronizacja aktywna';save();if($('#fz26-overlay'))render();
 }catch(e){if(generation!==cloudGeneration)return;cloudReady=false;clearCloudState();cloudError=e.message||'Brak konfiguracji chmury';console.warn('SPORTIVRA cloud:',cloudError);if($('#fz26-overlay'))render()}finally{cloudLoading=false;if(cloudRetry){cloudRetry=false;setTimeout(()=>cloudInit(),0)}}}
window.addEventListener('sportivra-wallet-changed',()=>cloudInit());
async function cloudRpc(name,args={}){if(!cloudReady||!cloudDb)throw Error('Wymagane logowanie i migracja Supabase: '+cloudError);const {data,error}=await cloudDb.rpc(name,args);if(error)throw error;return data}
function cloudWarn(e){alert('Operacja nie została wykonana: '+(e?.message||e))}
function save(){localStorage.setItem(KEY,JSON.stringify(state));$('#fz26-coins')?.replaceChildren(document.createTextNode(cloudReady?state.coins.toLocaleString('pl-PL'):'—'))}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-86400000));
if(state.lastLogin!==today()){state.streak=state.lastLogin===yesterday()?state.streak+1:1;state.lastLogin=today();save()}
const random=(max)=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296*max};
function chooseEgg(egg){const x=random(100);let sum=0,tier=0;for(let i=0;i<egg.w.length;i++){sum+=egg.w[i];if(x<sum){tier=i;break}}const pool=allPets.filter(p=>p.tier===tier);return pool[Math.floor(random(pool.length))]}
function dailyShop(){const d=today().replaceAll('-','');let seed=Number(d);const choices=[];for(let i=0;i<4;i++){seed=(seed*1664525+1013904223)>>>0;choices.push(eggTypes[seed%eggTypes.length])}return choices}
function notice(s){state.notices.unshift({at:new Date().toISOString(),text:s});state.notices=state.notices.slice(0,60);save()}
function spend(n){if(state.coins<n){alert('Za mało monet SPORTIVRA.');return false}state.coins-=n;save();return true}
const css=`#fz26-launch{position:fixed;bottom:78px;right:14px;z-index:9000;background:#baff45;color:#101827;border:0;border-radius:30px;padding:12px 18px;font-weight:900;box-shadow:0 8px 35px #0008}#fz26-overlay{position:fixed;inset:0;z-index:99995;background:#050a14ee;overflow:auto;color:#f5f8ff;font:15px/1.5 system-ui}#fz26-app{max-width:1100px;margin:24px auto;padding:16px}#fz26-app .panel{background:#121f33;border:1px solid #2a405b;border-radius:18px;padding:18px;margin:12px 0}#fz26-app .items{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}#fz26-app .item{background:#192b43;border:1px solid #344c66;border-radius:14px;padding:14px;text-align:center}#fz26-app .art{font-size:53px;background:radial-gradient(circle,#354a70,#101b2b);border-radius:12px;padding:12px;margin-bottom:8px}#fz26-app button,#fz26-app select,#fz26-app input{background:#243b55;color:white;border:1px solid #46627c;border-radius:9px;padding:9px;margin:3px;cursor:pointer}#fz26-app button.action{background:#baff45;color:#142019;font-weight:800}#fz26-app .tabs{display:flex;gap:6px;flex-wrap:wrap}#fz26-app .tabs button.on{background:#baff45;color:#142019}#fz26-app small{color:#9aacc4}#fz26-app .petcard{border-top:4px solid var(--tier)}#fz26-app .reveal{animation:fz26Pop .75s ease both;font-size:80px}#fz26-app .shaking{animation:fz26Shake .16s infinite alternate;font-size:85px}@keyframes fz26Shake{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}@keyframes fz26Pop{from{opacity:0;transform:scale(.2) rotate(-20deg)}to{opacity:1;transform:scale(1)}}#fz26-app .progress{height:9px;background:#263d53;border-radius:12px;overflow:hidden}#fz26-app .progress span{display:block;height:100%;background:#baff45}#fz26-app .hint{background:#203249;padding:10px;border-radius:10px;color:#bbcadc}#fz26-app h2{margin:5px 0 14px}`;const st=document.createElement('style');st.textContent=css;document.head.append(st);
const launch=document.createElement('button');launch.id='fz26-launch';launch.textContent='🐾 ULTIMATE 2.6';document.body.append(launch);launch.onclick=()=>open();
let tab='pets';function open(t){cloudInit();if(t)tab=t;let overlay=$('#fz26-overlay');if(!overlay){overlay=document.createElement('div');overlay.id='fz26-overlay';document.body.append(overlay)}render()}
const tabs=[['pets','🐾 Pety'],['eggs','🥚 Jajka'],['shop','🛒 Sklep'],['events','🎪 Eventy'],['pass','🎟️ FOOT PASS'],['social','👥 Społeczność'],['arcade','🎮 Arcade'],['profile','🏅 Profil'],['news','📰 News/AI']];
function render(){const root=$('#fz26-overlay');if(!root)return;const language=localStorage.getItem('sportivra_lang')==='en'?'en':'pl';root.innerHTML=`<div id="fz26-app"><header style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><h1 style="margin:0">👑 SPORTIVRA 2.6 ULTIMATE</h1><small id="fz26-cloud-status">${cloudReady?'🟢 Nagrody i zakupy: zapis serwerowy':'🟡 Nagrody i zakupy zablokowane do podłączenia Supabase: '+esc(cloudError)}</small></div><div><label for="fz26-lang">Język quizu i wiadomości / Quiz and news language</label><select id="fz26-lang"><option value="pl" ${language==='pl'?'selected':''}>Polski</option><option value="en" ${language==='en'?'selected':''}>English</option></select> 🪙 <b id="fz26-coins">${cloudReady?state.coins.toLocaleString('pl-PL'):'—'}</b> <button id="fz26-close">✕ Zamknij</button></div></header><div class="tabs">${tabs.map(([id,name])=>`<button data-tab="${id}" class="${id===tab?'on':''}">${name}</button>`).join('')}</div><section id="fz26-view"></section></div>`;root.querySelector('#fz26-close').onclick=()=>root.remove();root.querySelector('#fz26-lang').onchange=e=>{const lang=e.target.value==='en'?'en':'pl';localStorage.setItem('sportivra_lang',lang);localStorage.setItem('fz26_locale',lang);render()};root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});draw()}
function draw(){const v=$('#fz26-view');if(!v)return;
if(tab==='pets'){const own=state.owned;const counts=cloudReady?state.petCounts:Object.fromEntries(own.map(id=>[id,own.filter(x=>x===id).length]));v.innerHTML=`<div class="panel"><h2>🐾 PETDEX 2.0 — ${new Set(own).size}/1200</h2><div class="progress"><span style="width:${new Set(own).size/1200*100}%"></span></div><p>Posiadane egzemplarze: ${Object.values(counts).reduce((a,b)=>a+b,0)} • Shiny: ${state.shiny.length}.</p><label>Filtr <select id="fz26-filter"><option value="owned">Moje pety</option><option value="all">Pełny katalog (1200)</option></select></label><button id="fz26-backup-pets" type="button">💾 Eksport starej kolekcji (kopia bezpieczeństwa)</button><label>📥 Zgłoś starą kolekcję do przeniesienia <input id="fz26-import-pets" type="file" accept=".json,application/json"></label><small>Import wymaga zatwierdzenia administratora. Nie przyznaje petów automatycznie.</small><div id="fz26-page-controls"></div><div class="items" id="fz26-pets"></div><h3>🎪 Pety eventowe</h3><div class="items" id="fz26-event-pets"></div></div>`;$('#fz26-backup-pets').onclick=exportLegacyPets;$('#fz26-import-pets').onchange=submitLegacyPets;let petPage=0;const list=()=>{let items=$('#fz26-filter').value==='owned'?[...new Set(own)].map(id=>allPets[id-1]).filter(Boolean):allPets;const pages=Math.max(1,Math.ceil(items.length/60));petPage=Math.min(petPage,pages-1);const controls=$('#fz26-page-controls');controls.innerHTML=`<p>Strona ${petPage+1} z ${pages} • ${items.length} petów</p><button id="fz26-prev" ${petPage===0?'disabled':''}>← Poprzednia</button> <button id="fz26-next" ${petPage>=pages-1?'disabled':''}>Następna →</button>`;$('#fz26-prev').onclick=()=>{petPage--;list()};$('#fz26-next').onclick=()=>{petPage++;list()};items=items.slice(petPage*60,(petPage+1)*60);$('#fz26-pets').innerHTML=items.map(p=>`<div class="item petcard" style="--tier:${colors[p.tier]}"><div class="art"><img src="${petImage(p.id)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;max-width:128px;aspect-ratio:1;object-fit:contain;border-radius:14px;filter:${state.shiny.includes(p.id)?'drop-shadow(0 0 13px #ffe879) saturate(1.7)':'none'}"></div><b>${esc(p.name)}</b><p><small>${types[p.tier]} • poz. ${state.levels[p.id]||1} ${state.shiny.includes(p.id)?'✨ SHINY':''} • sztuk: ${counts[p.id]||0}</small></p>${own.includes(p.id)?`<button data-evolve="${p.id}">Ewolucja (3×)</button><button data-shiny="${p.id}">Shiny (5×)</button>`:'🔒'}</div>`).join('');$('#fz26-pets').querySelectorAll('[data-evolve]').forEach(b=>b.onclick=()=>upgrade(+b.dataset.evolve,3,false));$('#fz26-pets').querySelectorAll('[data-shiny]').forEach(b=>b.onclick=()=>upgrade(+b.dataset.shiny,5,true))};$('#fz26-filter').onchange=()=>{petPage=0;list()};list();const eventPetDetails=new Map((window.FZ26_EVENT_CATALOG||[]).flatMap(e=>e.pets.map(p=>[p.id,p])));const eventEntries=Object.entries(state.eventPets||{}).filter(([,count])=>count>0);$('#fz26-event-pets').innerHTML=eventEntries.length?eventEntries.map(([id,count])=>{const p=eventPetDetails.get(id);return `<div class="item"><b>${esc(p?.name||id)}</b><p><small>${esc(p?.rarity||'event')} • sztuk: ${count}</small></p></div>`}).join(''):'<p>Brak petów eventowych w ekwipunku.</p>'}
if(tab==='eggs'){v.innerHTML=`<div class="panel"><h2>🥚 Otwieranie jajek</h2><p class="hint">Otwieranie jajek wymaga zalogowania. Losowanie i pobranie monet odbywają się w Supabase.</p><div id="fz26-reveal" style="text-align:center;min-height:140px"></div><div class="items">${eggTypes.map((e,i)=>`<div class="item"><div class="art">${e.e}</div><b>${e.n}</b><p>🪙 ${e.cost}</p><button class="action" data-open="${i}">Otwórz 1</button><button data-triple="${i}">Otwórz 3</button><details><summary>Szanse</summary>${e.w.map((w,j)=>`${types[j]}: ${w}%`).join('<br>')}</details></div>`).join('')}</div></div>`;v.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>hatch(+b.dataset.open,1));v.querySelectorAll('[data-triple]').forEach(b=>b.onclick=()=>hatch(+b.dataset.triple,3))}
if(tab==='shop'){const eggs=dailyShop();v.innerHTML=`<div class="panel"><h2>🛒 FOOT SHOP — oferta dnia ${today()}</h2><p>Rotacja codziennie o 00:00 czasu polskiego (oferta taka sama na urządzeniach z poprawną datą).</p><div class="items">${eggs.map((e,i)=>`<div class="item"><div class="art">${e.e}</div><b>${e.n}</b><p>${e.cost} monet</p><button data-buy="${eggTypes.indexOf(e)}">Otwórz za monety</button></div>`).join('')}</div></div><div class="panel"><h2>✨ VIP LOOK</h2><div class="items">${['Neonowa ramka','Złota aura','Kosmiczne tło','Efekt zwycięzcy'].map((n,i)=>`<div class="item"><div class="art">${['💚','👑','🌌','🏆'][i]}</div><b>${n}</b><p>${300+i*200} monet</p><button data-decor="${i}">${state.decor.includes(n)?'Posiadasz':'Kup'}</button></div>`).join('')}</div></div>`;v.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>hatch(+b.dataset.buy,1));v.querySelectorAll('[data-decor]').forEach(b=>b.onclick=()=>{const i=+b.dataset.decor,n=['Neonowa ramka','Złota aura','Kosmiczne tło','Efekt zwycięzcy'][i];if(state.decor.includes(n))return;(async()=>{try{const r=await cloudRpc('fz26_buy_decor',{decor_id:i+1});state.coins=r.coins;state.decor.push(r.item);notice('Kupiono: '+r.item);save();draw()}catch(err){cloudWarn(err)}})()})}
if(tab==='events'){const catalog=window.FZ26_EVENT_CATALOG||[];v.innerHTML=`<div class="panel"><h2>🎪 FOOT EVENTS — ${catalog.length} wydarzeń</h2><p>Każdy event ma katalog 10 petów, 3 jajek z wagami losowania, 3 misji i 2 dekoracji. <b>Zakupy eventowe wymagają wdrożenia SQL 09 i aktywowania wydarzenia przez administratora. Misja logowania i sklep działają po wdrożeniu SQL 13; misje quizu i Fantasy wymagają zweryfikowanych danych.</b></p><div id="fz26-liveevents" class="hint">Sprawdzanie aktywnych eventów…</div><label>Wybierz wydarzenie <select id="fz26-event-choice">${catalog.map((e,i)=>`<option value="${i}">${esc(e.title)}</option>`).join('')}</select></label><div id="fz26-event-details"></div></div>`;const show=()=>{const e=catalog[Number($('#fz26-event-choice').value)];if(!e)return;$('#fz26-event-details').innerHTML=`<h3>🐾 Pety (${e.pets.length})</h3><div class="items">${e.pets.map(p=>`<div class="item"><b>${esc(p.name)}</b><p><small>${esc(p.rarity)} • ${esc(p.id)}</small></p></div>`).join('')}</div><h3>🥚 Jajka (${e.eggs.length})</h3><div class="items">${e.eggs.map(g=>`<div class="item"><b>${esc(g.name)}</b><details><summary>Wagi losowania</summary>${g.odds.map(x=>`${esc(x.pet_id)}: ${x.weight}`).join('<br>')}</details></div>`).join('')}</div><p><button class="action" id="fz26-event-egg">🥚 Otwórz wybrane jajko (700 monet)</button> <select id="fz26-event-egg-id">${e.eggs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></p><h3>🎯 Misje wydarzenia</h3>${e.missions.map((m,i)=>`<p>• ${esc(m.title)} — ${m.target} → ${m.reward_coins} monet ${i===0?'<small>(naliczana automatycznie przy synchronizacji konta)</small>':'<small>(wymaga potwierdzonych statystyk)</small>'}</p>`).join('')}<h3>🛍️ Sklep wydarzenia</h3>${e.shop.map(a=>`<p>• ${esc(a.name)} — ${a.price_coins} monet <button class="action fz26-event-buy" data-item="${esc(a.id)}">Kup</button></p>`).join('')}`};$('#fz26-event-choice').onchange=show;show();v.onclick=async ev=>{const target=ev.target;if(!target)return;const e=catalog[Number($('#fz26-event-choice').value)];if(!e)return;const isEgg=target.id==='fz26-event-egg',isLogin=target.id==='fz26-event-login',isBuy=target.classList?.contains('fz26-event-buy');if(!isEgg&&!isLogin&&!isBuy)return;try{if(!cloudReady)throw Error('Zaloguj się i wdroż migracje SQL');target.disabled=true;let r;if(isEgg){r=await cloudRpc('fz26_open_event_egg',{p_event:e.id,p_egg:$('#fz26-event-egg-id').value});notice('Zdobyto peta eventowego: '+r.pet_id);alert('Zdobyto: '+r.pet_id)}else if(isLogin){r=await cloudRpc('fz26_claim_event_login',{p_event:e.id});notice('Misja eventowa: +'+r.reward+' monet');alert('Odebrano '+r.reward+' monet')}else{r=await cloudRpc('fz26_buy_event_decor',{p_event:e.id,p_item:target.dataset.item});notice('Kupiono dekorację: '+r.item);alert('Kupiono: '+r.item)}state.coins=r.coins;save();await cloudInit();draw()}catch(err){cloudWarn(err);target.disabled=false}};loadEvents()}
if(tab==='pass'){const done=state.claimed;v.innerHTML=`<div class="panel"><h2>🎟️ FOOT PASS — sezon 1</h2><p>50 poziomów • XP naliczane jest przez dostępne akcje serwerowe. Minigry Arcade nie przyznają obecnie XP. Postęp modułu: ${state.pass} XP.</p><div class="progress"><span style="width:${state.pass%100}%"></span></div><div class="items">${Array.from({length:50},(_,i)=>`<div class="item"><b>Poziom ${i+1}</b><p>🎁 ${100+i*10} monet</p><button data-pass="${i+1}" ${state.pass<(i+1)*100||done.includes(i+1)?'disabled':''}>${done.includes(i+1)?'Odebrane':'Odbierz'}</button></div>`).join('')}</div></div>`;v.querySelectorAll('[data-pass]').forEach(b=>b.onclick=()=>{let i=+b.dataset.pass;if(state.pass<i*100||state.claimed.includes(i))return;(async()=>{try{const r=await cloudRpc('fz26_claim_pass_level',{p_level:i});state.claimed.push(i);state.coins=r.coins;notice('Nagroda FOOT PASS poziom '+i);save();draw()}catch(err){cloudWarn(err)}})()})}
if(tab==='social'){
 v.innerHTML='<div class="panel"><h2>👥 Znajomi i Fantasy 2.0</h2><p>Profile, zaproszenia, prywatne ligi i składy są zapisywane na serwerze. Wymaga logowania i migracji SQL 10.</p><div id="fz26-social-content">Ładowanie…</div></div>';
 if(window.FZ26Social?.open)window.FZ26Social.open(v.querySelector('#fz26-social-content'));
 else v.querySelector('#fz26-social-content').textContent='Moduł znajomych nie został załadowany.';
 const roster=document.createElement('div');roster.id='sv26-roster';roster.className='panel';roster.innerHTML='<h3>⚽ Zawodnicy i punkty Fantasy</h3>';v.appendChild(roster);if(window.SV26Roster?.open)window.SV26Roster.open(roster);
 else roster.textContent='Moduł zawodników nie został załadowany.';
}
if(tab==='arcade'){v.innerHTML='<div id="sv26-arcade-root"></div><div id="sv26-weekly-quiz" class="panel"></div>';if(window.SV26ArcadeGames)window.SV26ArcadeGames.mount(v.querySelector('#sv26-arcade-root'));if(window.SV26WeeklyArcade)window.SV26WeeklyArcade.render(v.querySelector('#sv26-weekly-quiz'),{rpc:cloudRpc,onReward:r=>{state.coins=r.coins;save()}});}
if(tab==='profile'){v.innerHTML=`<div class="panel"><h2>🏅 Mój profil ULTIMATE</h2><p>🔥 Seria logowania: ${state.streak} dni • 🐾 Pety: ${Object.values(state.petCounts).reduce((a,b)=>a+b,0)} • 🎮 Punkty arcade: ${state.arcade}</p><button id="fz26-daily" class="action" ${state.daily[today()+':login']?'disabled':''}>🎁 Odbierz codzienną nagrodę +100</button><label>Data urodzin (opcjonalnie) <input id="fz26-bday" type="date" value="${esc(state.birthday)}"></label><button id="fz26-bsave">Zapisz datę</button><p>🎂 Prezent urodzinowy: funkcja pokazowa, bez nagród monetowych.</p><button id="fz26-bgift">Odbierz prezent urodzinowy</button><h3>🔔 Powiadomienia</h3>${state.notices.slice(0,10).map(x=>`<p>• ${esc(x.text)}</p>`).join('')||'<p>Brak powiadomień.</p>'}<h3>📜 Historia sezonów</h3><p>Sezon 1 — trwa • ${state.pass} XP</p></div>`;$('#fz26-daily').onclick=()=>{if(state.daily[today()+':login'])return;(async()=>{try{const result=await cloudRpc('fz26_claim_daily');state.daily[today()+':login']=true;state.coins=result.coins;state.pass=result.xp;notice('Nagroda dzienna +100');save();draw()}catch(e){cloudWarn(e)}})()};$('#fz26-bsave').onclick=()=>{state.birthday=$('#fz26-bday').value;save();alert('Zapisano lokalnie')};$('#fz26-bgift').onclick=()=>{const b=state.birthday,now=today();if(!b||b.slice(5)!==now.slice(5)||state.daily[now.slice(0,4)+':birthday']){alert('Prezent dostępny raz w roku, w dniu urodzin.');return}state.daily[now.slice(0,4)+':birthday']=true;notice('Prezent urodzinowy: wersja pokazowa, bez monet');save();draw()}}
if(tab==='news'){v.innerHTML=`<div class="panel"><h2>📰 SPORTIVRA NEWS</h2><p class="hint">Aktualności sportowe w SPORTIVRA. Wybierz dyscyplinę:</p><div style="display:flex;gap:8px;flex-wrap:wrap"><select id="fz26-news-category" style="padding:10px;border-radius:9px;background:#182a40;color:white"><option value="football">⚽ Piłka nożna</option><option value="basketball">🏀 Koszykówka</option><option value="volleyball">🏐 Siatkówka</option><option value="f1">🏎️ F1</option><option value="handball">🤾 Piłka ręczna</option><option value="esports">🎮 Esport</option></select><button id="fz26-news-reload" class="action">Odśwież</button></div><div id="fz26-news-feed" aria-live="polite" style="margin-top:16px">Ładowanie aktualności…</div><p class="hint">Nagłówki pochodzą z publicznych kanałów RSS. Wiadomości czytasz tutaj. Jeśli kanał RSS nie udostępnia pełnej treści, pokazujemy dostępny opis.</p></div><div class="panel"><h2>🤖 FOOT AI</h2><p class="hint">Wymaga skonfigurowania funkcji serwerowej i limitu usługi AI.</p><textarea id="fz26-ai-question" maxlength="700" placeholder="Zapytaj o sport..." style="width:100%;min-height:80px;background:#192b43;color:white"></textarea><p><button id="fz26-ai-send" class="action">Wyślij pytanie</button></p><div id="fz26-ai-answer" class="hint" role="status">Zaloguj się, aby zapytać.</div></div>`;
 const feed=$('#fz26-news-feed');const loadNews=async()=>{feed.textContent='Ładowanie aktualności…';try{const category=$('#fz26-news-category').value;const lang=localStorage.getItem('sportivra_lang')==='en'?'en':'pl';const response=await fetch(window.SPORTIVRA_CONFIG.supabaseUrl + '/functions/v1/foot-news?category='+encodeURIComponent(category)+'&lang='+lang,{headers:{apikey:window.SPORTIVRA_CONFIG.supabasePublishableKey,Authorization:'Bearer '+window.SPORTIVRA_CONFIG.supabasePublishableKey}});if(!response.ok)throw Error('Serwer wiadomości jest niedostępny');const data=await response.json();feed.replaceChildren();if(!data.items?.length){feed.textContent='Brak aktualnych wiadomości.';return}for(const item of data.items){
 const article=document.createElement('details');article.style.cssText='padding:14px;margin:8px 0;background:#18283d;border:1px solid #32445d;border-radius:12px;color:#f5f8fc';
 const heading=document.createElement('summary');heading.style.cssText='cursor:pointer;font-weight:700';heading.textContent=item.title||'Wiadomość';article.append(heading);
 const date=document.createElement('div');date.style.cssText='font-size:12px;color:#aebcd0;margin-top:8px';const dt=new Date(item.date);date.textContent=Number.isFinite(dt.getTime())?dt.toLocaleString(lang==='en'?'en-GB':'pl-PL'):'';article.append(date);
 const body=document.createElement('p');body.style.cssText='line-height:1.6;white-space:pre-wrap';body.textContent=(item.summary||'Kanał udostępnił tylko nagłówek tej wiadomości.');article.append(body);
 const credit=document.createElement('small');credit.style.cssText='display:block;color:#9fb0c8;margin-top:10px';if(typeof item.source==='string'&&item.source.trim()){credit.textContent=(lang==='en'?'Source: ':'Źródło wiadomości: ')+item.source.trim()}else{try{credit.textContent=(lang==='en'?'Source: ':'Źródło wiadomości: ')+new URL(item.url).hostname.replace(/^www\./,'')}catch{credit.textContent=lang==='en'?'Source: external RSS feed':'Źródło: zewnętrzny kanał RSS'}}article.append(credit);
 feed.append(article)
 }}catch(e){feed.textContent='⚠️ '+e.message+' — po wdrożeniu funkcji foot-news spróbuj ponownie.'}};$('#fz26-news-category').onchange=loadNews;$('#fz26-news-reload').onclick=loadNews;loadNews();
 const ai=$('#fz26-ai-send');if(ai)ai.onclick=async()=>{const out=$('#fz26-ai-answer');out.textContent='Pytam FOOT AI…';try{if(!cloudDb||!cloudReady)throw Error('Najpierw zaloguj się i uruchom SQL');const {data,error}=await cloudDb.functions.invoke('foot-ai',{body:{question:$('#fz26-ai-question').value}});if(error)throw error;out.textContent=data?.answer||'Brak odpowiedzi'}catch(e){out.textContent='⚠️ '+(e.message||'Błąd FOOT AI')}};
 }
}
async function upgrade(id,n,shiny){
 if(!cloudReady){cloudWarn(Error(cloudError));return}
 if(shiny&&state.shiny.includes(id)){alert('Ten pet jest już SHINY.');return}
 try{const r=await cloudRpc('fz26_upgrade_pet',{pet_id:id,make_shiny:shiny});
 state.petCounts[id]=Number(r.quantity)||0;state.owned=state.owned.filter(x=>x!==id);if(state.petCounts[id]>0)state.owned.push(id);
 if(shiny){if(!state.shiny.includes(id))state.shiny.push(id)}else state.levels[id]=r.level;
 save();draw();notice(shiny?'✨ Odblokowano SHINY!':'⬆️ Pet awansował na poziom '+r.level)
 }catch(e){cloudWarn(e);await cloudInit()}
}
async function hatch(index,count){
 if(!cloudReady){cloudWarn(Error(cloudError));return}
 const egg=eggTypes[index];let rewards=[];
 try{for(let i=0;i<count;i++){const r=await cloudRpc('fz26_open_egg',{egg_id:index+1});state.coins=r.coins;state.petCounts[r.pet_id]=Math.max(0,Number(r.quantity??(Number(state.petCounts[r.pet_id])||0)+1));if(!state.owned.includes(r.pet_id))state.owned.push(r.pet_id);state.pass=Number(r.xp??(state.pass+10));rewards.push(allPets[r.pet_id-1])}save();}
 catch(e){await cloudInit();cloudWarn(e);return}
 tab='eggs';render();const r=$('#fz26-reveal');r.innerHTML='<div class="shaking">'+egg.e+'</div><p>Jajko pęka…</p>';
 setTimeout(()=>{if(!r.isConnected)return;r.innerHTML=`<div class="reveal">${rewards.map(p=>`<img src="${petImage(p.id)}" alt="${esc(p.name)}" style="width:100px;height:100px;border-radius:16px;margin:5px">`).join(' ')}</div><h3>${rewards.map(p=>esc(p.name)+' ('+types[p.tier]+')').join('<br>')}</h3><button id="fz26-see">Zobacz kolekcję</button>`;$('#fz26-see').onclick=()=>{tab='pets';render()}},1100)
}
async function loadEvents(){
 const box=$('#fz26-liveevents');if(!box)return;
 if(!cloudReady||!cloudDb){box.textContent='Zaloguj się, aby sprawdzić aktywne eventy.';return}
 try{
  const {data:rows,error}=await cloudDb.from('fz26_event_catalog').select('title,enabled,starts_at,ends_at');
  if(error)throw error;
  const now=Date.now(),active=(rows||[]).filter(e=>e.enabled&&(!e.starts_at||Date.parse(e.starts_at)<=now)&&(!e.ends_at||Date.parse(e.ends_at)>now));
  box.textContent=active.length?'🟢 Aktywne: '+active.map(x=>x.title).join(', '):'Brak aktywnych eventów.';
 }catch{box.textContent='⚠️ Nie można odczytać eventów. Sprawdź konfigurację Supabase i migrację SQL 09.'}
}
function question(){const a=1+Math.floor(random(10)),b=1+Math.floor(random(10)),correct=a+b,answers=[correct,correct+2,Math.max(1,correct-1)].sort(()=>random(1)-.5);const q=$('#fz26-question');if(!q)return;q.innerHTML=`<h3>Ile to ${a} + ${b}?</h3>${answers.map(x=>`<button data-answer="${x}">${x}</button>`).join('')}`;q.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{if(+btn.dataset.answer===correct){state.arcade++;state.daily[today()+':games']=(state.daily[today()+':games']||0)+1;if(state.daily[today()+':games']<=5){/* no currency rewards in local arcade demo */}notice('Poprawna odpowiedź w FOOT ARCADE');save()}else alert('Spróbuj ponownie!');draw()})}
// Refresh cloud inventory when the player returns to the tab; local values are never uploaded as authority.
let fz26LastRefresh=0;
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-fz26LastRefresh>15000){fz26LastRefresh=Date.now();cloudInit()}});
// Export old local pet data for a reviewed migration; this does not grant items or coins.
function exportLegacyPets(){
 // Export only recognized pet fields, never entire localStorage objects or auth tokens.
 const records=[];const allowedKeys=['owned','pets','petCounts','shiny','levels'];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key||!/^fz|footzone/i.test(key))continue;
  try{
   const raw=localStorage.getItem(key);if(!raw||raw.length>2000000)continue;
   const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))continue;
   const data={};for(const field of allowedKeys)if(Object.prototype.hasOwnProperty.call(value,field))data[field]=value[field];
   if(Object.keys(data).length)records.push({key,data});
  }catch{}
 }
 const output={format:'footzone-pets-backup-v2',exportedAt:new Date().toISOString(),records};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SPORTIVRA_BACKUP_PETY_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function submitLegacyPets(e){
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>2000000){alert('Plik przekracza 2 MB');return}
 try{
  if(!cloudReady||!cloudDb||!cloudUser)throw Error('Najpierw zaloguj się i włącz Supabase');
  const payload=JSON.parse(await file.text());
  if(payload?.format!=='footzone-pets-backup-v2'||!Array.isArray(payload.records)||payload.records.length>50)throw Error('Niepoprawny format kopii');
  const counts={}, shiny=new Set(),levels={};
  for(const record of payload.records){
   const d=record?.data;if(!d||typeof d!=='object')continue;
   if(Array.isArray(d.owned))for(const raw of d.owned){const id=Number(raw);if(Number.isInteger(id)&&id>=1&&id<=1200)counts[id]=(counts[id]||0)+1}
   if(d.petCounts&&typeof d.petCounts==='object'&&!Array.isArray(d.petCounts))for(const [raw,n] of Object.entries(d.petCounts)){const id=Number(raw),qty=Number(n);if(Number.isInteger(id)&&id>=1&&id<=1200&&Number.isInteger(qty)&&qty>=0&&qty<=100000)counts[id]=Math.max(counts[id]||0,qty)}
   if(Array.isArray(d.shiny))for(const raw of d.shiny){const id=Number(raw);if(Number.isInteger(id)&&id>=1&&id<=1200)shiny.add(id)}
   if(d.levels&&typeof d.levels==='object')for(const [raw,n] of Object.entries(d.levels)){const id=Number(raw),lvl=Number(n);if(Number.isInteger(id)&&id>=1&&id<=1200&&Number.isInteger(lvl)&&lvl>=1&&lvl<=1000)levels[id]=Math.max(levels[id]||1,lvl)}
  }
  const normalized={counts,shiny:[...shiny],levels};
  if(Object.keys(counts).length===0)throw Error('Brak rozpoznanych petów w kopii');
  const {data,error}=await cloudDb.rpc('fz26_request_pet_migration',{payload:normalized});
  if(error)throw error;
  alert('Zgłoszenie migracji zapisane. Numer: '+data+'. Administrator musi zweryfikować i zatwierdzić kolekcję.');
 }catch(err){alert('Nie udało się zgłosić migracji: '+(err?.message||err))}
 finally{e.target.value=''}
}
window.FZ26={open,exportLegacyPets};setTimeout(cloudInit,1200);
})();
