/* SPORTIVRA fixtures retain their ticket IDs. Public schedules are informational. */
(()=>{'use strict';
 const state={mode:'week',day:new Date(),search:'',sport:'',country:'',tier:'',league:'',session:'',status:'all',page:0,total:0,rows:[],sports:[],countries:[],leagues:[],days:{},error:'',loading:false};
 let generation=0,timer=null,searchTimer=null,channel=null,currentRoot=null;
 let pending=false,source='auto',rangeOnly=false,timedOnly=false,notice='',catalog=null,lastResult='',activeRequest=null;
 const publicFeed=()=>window.SV27PublicFixtures;
 const allDates=()=>!!state.search.trim()&&!rangeOnly;
 const unique=items=>[...new Set(items.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl'));
 function setOptions(dbData) {
  const publicCatalog=source==='stored'?[]:(publicFeed()?.catalog || []);
  const publicSports=source==='stored'?[]:(publicFeed()?.sports || []);
  const canonicalSport=value=>{const key=fixtureKey(value);const map={soccer:'Piłka nożna',football:'Piłka nożna','pilka nozna':'Piłka nożna',basketball:'Koszykówka','koszykowka':'Koszykówka',volleyball:'Siatkówka','siatkowka':'Siatkówka',handball:'Piłka ręczna','pilka reczna':'Piłka ręczna',esports:'Esport',esport:'Esport','formula 1':'Formuła 1',f1:'Formuła 1',tennis:'Tenis',tenis:'Tenis',skiing:'Narty',narty:'Narty'};return map[key]||null};
  const normalizeCatalog=rows=>(rows||[]).map(item=>({...item,sport:canonicalSport(item.sport)})).filter(item=>item.sport);
  const allCatalog=[...normalizeCatalog(publicCatalog),...normalizeCatalog(dbData?.league_catalog)];
  const sportRows=allCatalog.filter(item=>!state.sport||item.sport===canonicalSport(state.sport));
  const tierRows=sportRows.filter(item=>!state.tier||String(item.tier)===state.tier);
  const countryRows=tierRows.filter(item=>!state.country||item.country===state.country);
  state.sports=unique([...(dbData?.sports||[]).map(canonicalSport),...publicSports.map(canonicalSport),...allCatalog.map(item=>item.sport)].filter(Boolean));
  state.countries=unique(tierRows.map(item=>item.country));
  state.leagues=unique(countryRows.map(item=>item.league));
 }
 const localDay=d=>{const x=new Date(d);return new Date(x.getFullYear(),x.getMonth(),x.getDate())};
 const dateInput=d=>{const x=localDay(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
 const span=()=>{const d=localDay(state.day);let start,end;if(state.mode==='day'){start=d;end=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)}else if(state.mode==='week'){start=new Date(d.getFullYear(),d.getMonth(),d.getDate()-(d.getDay()+6)%7);end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+7)}else{start=new Date(d.getFullYear(),d.getMonth(),1);end=new Date(d.getFullYear(),d.getMonth()+1,1)}return {start,end}};
 const dateTime=s=>{if(!s)return 'Nie podano';const d=new Date(s);return Number.isFinite(d.valueOf())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'Nie podano'};
 function matchTime(match){
  if(match.starts_at && Number.isFinite(Date.parse(match.starts_at)))return dateTime(match.starts_at);
  if(!match.date_only)return 'Godzina rozpoczęcia nieopublikowana';
  const [year,month,day]=match.date_only.split('-').map(Number);
  return new Date(year,month-1,day).toLocaleDateString('pl-PL')+' (źródło podało tylko datę)';
 }
 const phase=m=>m.display_status||(m.status==='finished'?'finished':m.status==='cancelled'?'cancelled':m.source_status==='finished'?'finished':m.source_status==='cancelled'?'cancelled':m.source_status==='live'?'live':m.source_status==='postponed'?'postponed':m.sv27_phase==='live'?'live':m.status==='locked'?'locked':new Date(m.starts_at)<=new Date()?'awaiting':'scheduled');
 const statuses={scheduled:'Nadchodzący',live:'Na żywo',finished:'Zakończony',cancelled:'Odwołany',locked:'Typowanie zamknięte',awaiting:'Oczekuje na wynik',postponed:'Przełożony'};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
 const button=(label,cb,disabled=false)=>{const b=el('button',label);b.type='button';b.disabled=disabled;b.addEventListener('click',cb);return b};
 function stop(){generation++;activeRequest?.abort();pending=false;lastResult='';clearInterval(timer);clearTimeout(searchTimer);timer=null;searchTimer=null;if(channel&&typeof db!=='undefined'&&db?.removeChannel){try{db.removeChannel(channel)}catch{}}channel=null;currentRoot=null}
 function option(value,label){const o=el('option',label);o.value=value;return o}
 function select(label,value,items,all,change){const s=el('select');s.setAttribute('aria-label',label);s.append(option('',all));for(const item of items)if(typeof item==='string'&&item)s.append(option(item,item));s.value=value;s.addEventListener('change',()=>change(s.value));return s}
 function safeLogo(url,alt){if(!url)return null;try{const u=new URL(url);if(u.protocol!=='https:')return null;const img=el('img');img.src=u.href;img.alt=alt;img.loading='lazy';img.referrerPolicy='no-referrer';img.className='sv27-cal-logo';img.addEventListener('error',()=>img.remove());return img}catch{return null}}
 function display(){const root=currentRoot;if(!root)return;
  const hadSearch=document.activeElement?.id==='sv27-cal-search'&&root.contains(document.activeElement);const caret=hadSearch?document.activeElement.selectionStart:null;
  root.replaceChildren();root.append(el('h2','📅 Terminarz meczów'));root.append(el('p','Godziny w Twojej strefie czasowej: '+(Intl.DateTimeFormat().resolvedOptions().timeZone||'lokalnej'),'muted'));
  const actions=el('div',null,'sv27-cal-row');for(const [mode,label] of [['day','Dzień'],['week','Tydzień'],['month','Miesiąc']]){const b=button(label,()=>{state.mode=mode;state.page=0;load()});if(state.mode===mode)b.classList.add('primary');actions.append(b)}
  actions.append(button('←',()=>{const d=localDay(state.day);if(state.mode==='month')d.setMonth(d.getMonth()-1,1);else d.setDate(d.getDate()-(state.mode==='week'?7:1));state.day=d;state.page=0;load()}));
  const date=el('input');date.type='date';date.value=dateInput(state.day);date.setAttribute('aria-label','Wybierz datę');date.addEventListener('change',()=>{if(!date.value)return;const [y,m,d]=date.value.split('-').map(Number);state.day=new Date(y,m-1,d);state.page=0;load()});actions.append(date);
  actions.append(button('→',()=>{const d=localDay(state.day);if(state.mode==='month')d.setMonth(d.getMonth()+1,1);else d.setDate(d.getDate()+(state.mode==='week'?7:1));state.day=d;state.page=0;load()}),button('Dzisiaj',()=>{state.day=new Date();state.page=0;load()}),button('Odśwież',()=>load()));root.append(actions);
  const filters=el('div',null,'sv27-cal-row');
  const search=el('input');search.id='sv27-cal-search';search.type='search';search.maxLength=100;search.placeholder='Drużyna, zawodnik lub liga';search.value=state.search;search.setAttribute('aria-label','Szukaj drużyny, zawodnika lub ligi');search.enterKeyHint='search';
  search.addEventListener('input',()=>{state.search=search.value;state.page=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchTimer=null;load()},350)});
  search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();load()}});
  const activeSport=canonicalSportForUi(state.sport);
  search.placeholder=activeSport==='Formuła 1'?'Grand Prix lub sesja':'Drużyna, zawodnik lub liga';
  filters.append(search);
  filters.append(select('Sport',state.sport,state.sports,'Wszystkie sporty',v=>{state.sport=v;state.country='';state.tier='';state.league='';state.session='';state.page=0;load()}));
  if(!state.sport||['Piłka nożna','Koszykówka'].includes(activeSport)){
   const tier=el('select');tier.setAttribute('aria-label','Poziom ligi');tier.append(option('','Wszystkie poziomy'),option('1','Liga 1'),option('2','Liga 2'),option('3','Liga 3'));tier.value=state.tier;tier.addEventListener('change',()=>{state.tier=tier.value;state.league='';state.page=0;load()});filters.append(tier);
  }
  if(activeSport!=='Formuła 1'&&state.countries.length)filters.append(select('Kraj',state.country,state.countries,'Wszystkie kraje',v=>{state.country=v;state.league='';state.page=0;load()}));
  if(activeSport!=='Formuła 1'&&state.leagues.length)filters.append(select('Liga',state.league,state.leagues,'Wszystkie ligi',v=>{state.league=v;state.page=0;load()}));
  if(activeSport==='Formuła 1'){
   const session=el('select');session.setAttribute('aria-label','Sesja F1');session.append(option('','Wszystkie sesje'),option('Kwalifikacje','Kwalifikacje'),option('Sprint','Sprint'),option('Wyścig','Wyścig'));session.value=state.session;session.addEventListener('change',()=>{state.session=session.value;state.page=0;load()});filters.append(session);
  }
  const status=el('select');status.setAttribute('aria-label','Status');status.append(option('all','Wszystkie statusy'));for(const [key,value] of Object.entries(statuses))status.append(option(key,value));status.value=state.status;status.addEventListener('change',()=>{state.status=status.value;state.page=0;load()});filters.append(status);root.append(filters);
  const sourceSelect=el('select');sourceSelect.setAttribute('aria-label','Źródło meczów');
  for(const [key,label] of [['auto','Automatyczny wybór źródła'],['stored','Mecze SPORTIVRA'],['public','Publiczny terminarz']])sourceSelect.append(option(key,label));
  sourceSelect.value=source;sourceSelect.onchange=()=>{source=sourceSelect.value;state.page=0;load()};filters.append(sourceSelect);
  if(state.sport||state.country||state.tier||state.league||state.session||state.search||state.status!=='all'||source!=='auto'||rangeOnly||timedOnly){
   filters.append(button('Wyczyść filtry',()=>{
    Object.assign(state,{sport:'',country:'',tier:'',league:'',session:'',search:'',status:'all',page:0});
    rangeOnly=false;timedOnly=false;source='auto';load();
   }));
  }
  const rangeLabel=el('label',null,'sv27-range');const range=el('input');range.type='checkbox';range.checked=rangeOnly;
  range.onchange=()=>{rangeOnly=range.checked;state.page=0;load()};rangeLabel.append(range,' Szukaj tylko w wybranych datach');const timeLabel=el('label',null,'sv27-range'),timeCheck=el('input');
  timeCheck.type='checkbox';timeCheck.checked=timedOnly;
  timeCheck.onchange=()=>{timedOnly=timeCheck.checked;state.page=0;load()};
  timeLabel.append(timeCheck,' Tylko mecze z podaną godziną');
  const options=el('div',null,'sv27-cal-row');options.append(rangeLabel,timeLabel);root.append(options);
  root.append(el('div',null,'sv27-results'));displayResults();
  if(hadSearch){search.focus();if(caret!=null)search.setSelectionRange(caret,caret)}
 }
 function displayResults(){
  const host=currentRoot?.querySelector('.sv27-results');if(!host)return;
  const opened=new Set([...host.querySelectorAll('details[open]')].map(item=>item.dataset.key));
  host.replaceChildren();
  const info=el('p',state.loading?'Ładowanie meczów…':state.error||`Znaleziono meczów: ${state.total}.`,'muted');
  info.setAttribute('role','status');host.append(info);
  if(notice){
   const message=el('p',notice,'muted');
   if(notice.includes('OpenLigaDB')){
    const link=el('a',' OpenLigaDB · licencja ODbL');
    link.href='https://www.openligadb.de/en/license';link.target='_blank';link.rel='noopener noreferrer';
    message.append(link);
   }
   host.append(message);
  }
  if(notice.includes('SportStatsAPI')||notice.includes('synchroniz')||state.rows.some(row=>row.source_provider==='sportstatsapi')){
   const credit=el('p',null,'muted');credit.append(document.createTextNode('Dane terminarza: '));
   const link=el('a','SportStatsAPI');link.href='https://sportstatsapi.com/';link.target='_blank';link.rel='noopener noreferrer';
   credit.append(link);host.append(credit);
  }
  if(!state.loading&&!state.error&&state.mode!=='day'&&!allDates())drawGrid(host);
  const list=el('div',null,'sv27-cal-list');host.append(list);drawList(list);
  for(const detail of list.querySelectorAll('details'))detail.open=opened.has(detail.dataset.key);
 }
 function drawList(container){if(state.error||state.loading)return;if(!state.rows.length){container.append(el('p',allDates()?'Nie znaleziono meczów. Spróbuj wpisać fragment nazwy drużyny lub wyczyścić filtry.':'Brak meczów dla wybranych filtrów i dat. Zmień zakres dat lub wpisz nazwę drużyny.'));return}
  for(const m of state.rows){const detail=el('details',null,'sv27-match'),sum=el('summary');detail.dataset.key=String(m.id);const homeLogo=safeLogo(m.home_logo_url,'');if(homeLogo)sum.append(homeLogo);sum.append(el('strong',`${m.home} — ${m.away}`));const awayLogo=safeLogo(m.away_logo_url,'');if(awayLogo)sum.append(awayLogo);const sourceOnly=(m.source_status&&['live','finished','cancelled','postponed'].includes(m.source_status)&&!['finished','cancelled'].includes(m.status));sum.append(document.createTextNode(' • '+matchTime(m)+' • '+(statuses[phase(m)]||'Status nieznany')+(sourceOnly?' (dane dostawcy)':'')));detail.append(sum);
   const league=el('p');const leagueLogo=safeLogo(m.league_logo_url,'');if(leagueLogo)league.append(leagueLogo);league.append(document.createTextNode(`Liga: ${m.league||'Nie podano'} • Sport: ${m.sport||'Nie podano'}${m.country?' • Kraj: '+m.country:''}`));detail.append(league);
   if(m.kickoff_source)detail.append(el('p','Źródło godziny: '+m.kickoff_source+'. Godzina może się zmienić.'));
   detail.append(el('p',`Rozpoczęcie: ${matchTime(m)}${m.ends_at?' • Zakończenie: '+dateTime(m.ends_at):''}`));
   if(m.source_needs_review)detail.append(el('p','Dane dostawcy różnią się od danych meczu i oczekują na weryfikację.'));
   if(m.source_starts_at&&Date.parse(m.source_starts_at)!==Date.parse(m.starts_at))detail.append(el('p',`Inny termin według dostawcy: ${dateTime(m.source_starts_at)}. Rozliczenie wymaga weryfikacji.`));
   if(m.source_score_home!=null&&m.source_score_away!=null)detail.append(el('p',`Wynik dostawcy: ${m.source_score_home} : ${m.source_score_away}${m.status!=='finished'?' (niepotwierdzony do rozliczenia)':''}`));
   if(m.score_home!=null&&m.score_away!=null)detail.append(el('p',`${m.source_provider==='openfootball'?'Wynik':'Wynik zatwierdzony'}: ${m.score_home} : ${m.score_away}`));else if(m.result)detail.append(el('p',`Rozstrzygnięcie: ${m.result}`));
   if(m.participants_search)detail.append(el('p',`Zawodnicy: ${m.participants_search}`));container.append(detail)}
  const controls=el('div',null,'sv27-cal-row');controls.append(button('← Poprzednia',()=>{state.page--;load()},state.page<=0));controls.append(el('span',`Strona ${state.page+1} z ${Math.max(1,Math.ceil(state.total/50))}`));controls.append(button('Następna →',()=>{state.page++;load()},(state.page+1)*50>=state.total));container.append(controls)
 }
 function drawGrid(root){const {start,end}=span(),grid=el('div',null,'sv27-cal-grid');let d=localDay(start);if(state.mode==='month')d.setDate(d.getDate()-(d.getDay()+6)%7);const n=state.mode==='week'?7:42;for(let i=0;i<n;i++){const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i),key=dateInput(day),count=state.days[key]||0;const b=button(day.toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'})+(count?` · ${count}`:''),()=>{state.day=day;state.mode='day';state.page=0;load()});if(day<start||day>=end)b.classList.add('sv27-cal-outside');grid.append(b)}root.append(grid)}
 function updateOptionsInPlace(){
  for(const [label,values] of [['Sport',state.sports],['Kraj',state.countries],['Liga',state.leagues]]){
   const menu=currentRoot.querySelector('select[aria-label="'+label+'"]');
   if(!menu)continue;
   const existing=[...menu.options].slice(1).map(item=>item.value);
   if(JSON.stringify(existing)===JSON.stringify(values))continue;
   const value=menu.value;
   menu.replaceChildren(menu.options[0],...values.map(item=>option(item,item)));
   menu.value=value;
  }
 }
 function describe(error){return error?.message||String(error)}
 function fixtureKey(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim()}
 function canonicalSportForUi(value){const key=fixtureKey(value);const map={soccer:'Piłka nożna',football:'Piłka nożna','pilka nozna':'Piłka nożna',basketball:'Koszykówka','koszykowka':'Koszykówka',volleyball:'Siatkówka','siatkowka':'Siatkówka',handball:'Piłka ręczna','pilka reczna':'Piłka ręczna',esports:'Esport',esport:'Esport','formula 1':'Formuła 1',f1:'Formuła 1',tennis:'Tenis',tenis:'Tenis',skiing:'Narty',narty:'Narty'};return map[key]||''}
 function mergeFixtureRows(databaseRows,publicRows){
  const merged=[...(databaseRows||[])];let duplicates=0;
  for(const row of publicRows||[]){const home=fixtureKey(row.home),away=fixtureKey(row.away),time=Date.parse(row.starts_at||row.date_only||'');
   const duplicate=merged.some(old=>{if(String(old.id)===String(row.id))return true;const oldHome=fixtureKey(old.home),oldAway=fixtureKey(old.away),oldTime=Date.parse(old.starts_at||old.date_only||'');return home&&away&&home===oldHome&&away===oldAway&&Number.isFinite(time)&&Number.isFinite(oldTime)&&Math.abs(time-oldTime)<6*60*60*1000});
   if(duplicate){duplicates++;continue}merged.push(row);
  }
  merged.sort((a,b)=>Date.parse(a.starts_at||a.date_only)-Date.parse(b.starts_at||b.date_only)||String(a.id).localeCompare(String(b.id)));
  return {rows:merged,duplicates};
 }
 async function load(quiet=false){
  if(!currentRoot)return;
  clearTimeout(searchTimer);searchTimer=null;
  const token=++generation;
  activeRequest?.abort();
  pending=true;
  if(!quiet){
   state.loading=true;state.error='';notice='';
   setOptions(source==='public'?null:catalog);display();
  }
  const {start,end}=span();
  const query={start:start.toISOString(),end:end.toISOString(),sport:state.sport,country:state.country,
   tier:state.tier,league:state.league,session:state.session,search:state.search.trim(),status:state.status,
   timedOnly,anyDate:allDates(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',page:state.page};
  let problem='',result=null,info='',providerStatus='';
  try{
   if(typeof user==='undefined'||!user)throw Error('Zaloguj się, aby zobaczyć terminarz.');
   if(source!=='public'&&typeof db!=='undefined'&&db?.functions?.invoke){
    let timeout;
    try{
     const sync=await Promise.race([
      db.functions.invoke('calendar-kickoffs',{body:{start:query.start,end:query.end}}),
      new Promise(resolve=>{timeout=setTimeout(()=>resolve({error:Error('Synchronizacja terminarza jest w toku.') }),6500)})
     ]);
     if(sync?.error)providerStatus=describe(sync.error);
     else if(sync?.data?.message)providerStatus=sync.data.message;
     else if(sync?.data?.action==='imported'&&!sync.data.complete)
      providerStatus='Synchronizuję kolejne mecze wszystkich dostępnych lig. Lista odświeży się automatycznie.';
    }catch(error){providerStatus=describe(error)}finally{clearTimeout(timeout)}
   }
   if(source!=='public'){
    try{
     const request=db.rpc('sv27_calendar_find',{
      p_start:query.start,p_end:query.end,p_sport:query.sport||null,p_country:query.country||null,
      p_tier:query.tier?Number(query.tier):null,p_league:query.league||null,p_search:query.search||null,
      p_status:query.status,p_page:query.page,p_tz:query.tz,p_any_date:query.anyDate});
     const controller=new AbortController();
     activeRequest=controller;
     let timeout;
     let response;
     try{
      response=await Promise.race([
       request.abortSignal ? request.abortSignal(controller.signal) : request,
       new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(Error('Upłynął czas odpowiedzi Supabase.'));},6000)})
      ]);
     }finally{
      clearTimeout(timeout);
      if(activeRequest===controller)activeRequest=null;
     }
     const {data,error}=response;
     if(error)throw error;
     if(!Array.isArray(data?.rows))throw Error('Niepoprawna odpowiedź terminarza.');
     if(token!==generation)return;
     result=data;catalog=data;info='Mecze SPORTIVRA'+(query.anyDate?' · wyszukiwanie we wszystkich datach.':'.');
    }catch(error){
     problem=error?.code==='PGRST202'?'Zainstaluj SQL 41 dla terminarza w Supabase.':describe(error);
     if(source==='stored')throw Error(problem);
    }
   }
   if(token!==generation)return;
   if(source==='public'||source==='auto'){
    if(!publicFeed()){
     if(!result)throw Error(problem||'Brakuje pliku sv27-public-fixtures.js na stronie.');
     info+=' Publiczny terminarz jest niedostępny.';
    }else{
     const publicResult=await publicFeed().search(query);
     if(!Array.isArray(publicResult?.rows))throw Error('Niepoprawna odpowiedź publicznego terminarza.');
     info=[publicResult.notice||'Publiczny terminarz.',problem&&('Wyszukiwanie w SPORTIVRA niedostępne. '+problem)].filter(Boolean).join(' ');
     if(source==='public'){
      if(publicResult.unavailable&&!publicResult.total)throw Error(info);
      result=publicResult;catalog=publicResult;
     }else{
      const stored=result||{rows:[],total:0,days:{},sports:[],countries:[],leagues:[],league_catalog:[]};
      if(publicResult.unavailable&&!publicResult.total&&!stored.total)throw Error(info);
      const canonical=s=>{const k=fixtureKey(s);const aliases={soccer:'Piłka nożna',football:'Piłka nożna','pilka nozna':'Piłka nożna',basketball:'Koszykówka','koszykowka':'Koszykówka',volleyball:'Siatkówka','siatkowka':'Siatkówka',handball:'Piłka ręczna','pilka reczna':'Piłka ręczna',esports:'Esport',esport:'Esport','formula 1':'Formuła 1',f1:'Formuła 1',tennis:'Tenis',skiing:'Narty',narty:'Narty'};return aliases[k]||null};
      const cleanRows=rows=>(rows||[]).map(row=>({...row,sport:canonical(row.sport)})).filter(row=>row.sport);
      const cleanCatalog=rows=>(rows||[]).map(row=>({...row,sport:canonical(row.sport)})).filter(row=>row.sport);
      const combined=mergeFixtureRows(cleanRows(stored.rows),cleanRows(publicResult.rows));
      const combineCatalog=(a,b)=>[...new Map([...cleanCatalog(a),...cleanCatalog(b)].map(x=>[[x.sport,x.country,x.league].join('|'),x])).values()];
      catalog={...stored,sports:unique([...(stored.sports||[]).map(canonical),...(publicResult.sports||[]).map(canonical)].filter(Boolean)),countries:unique([...(stored.countries||[]),...(publicResult.countries||[])]),leagues:unique([...(stored.leagues||[]),...(publicResult.leagues||[])]),league_catalog:combineCatalog(stored.league_catalog,publicResult.league_catalog)};
      const days={...publicResult.days};for(const [day,count] of Object.entries(stored.days||{}))days[day]=Math.max(Number(days[day]||0),Number(count||0));
      result={...publicResult,rows:combined.rows,total:combined.rows.length,days};
      info=stored.total?'Połączono mecze zapisane w SPORTIVRA z publicznymi terminarzami. '+info:info;
     }
    }
   }
   if(token!==generation)return;
   if(query.session){const rows=(result.rows||[]).filter(row=>(row.session||row.away)===query.session);result={...result,rows,total:rows.length}}
   setOptions(source==='public'?null:catalog);
   state.rows=result.rows;state.total=Number(result.total)||0;state.days=result.days||{};state.error='';
   notice=[info,providerStatus].filter(Boolean).join(' ');
   const lastPage=Math.max(0,Math.ceil(state.total/50)-1);
   if(state.page>lastPage){state.page=lastPage;return load()}
  }catch(error){
   if(token!==generation)return;
   state.rows=[];state.total=0;state.days={};state.error='Nie udało się pobrać terminarza: '+describe(error);notice='';
  }finally{
   if(token===generation){
    pending=false;state.loading=false;
    const snapshot=JSON.stringify([state.rows,state.total,state.days,state.error,notice]);
    updateOptionsInPlace();
    if(!quiet||lastResult!==snapshot)displayResults();
    lastResult=snapshot;
   }
  }
 }
 function refreshVisible(){
  if(!currentRoot?.isConnected||active!=='📅 Terminarz'){stop();return}
  if(!document.hidden&&!pending&&!searchTimer)load(true);
 }
 const css=document.createElement('style');css.textContent='.sv27-cal-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}.sv27-cal-row input,.sv27-cal-row select{width:auto;min-width:160px;max-width:100%;margin:0}.sv27-range{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.sv27-range input[type=checkbox]{width:auto;margin:0}.sv27-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;overflow-x:auto}.sv27-cal-grid button{min-width:0;overflow-wrap:anywhere;font-size:12px;padding:8px 2px}.sv27-cal-outside{opacity:.55}.sv27-match{border:1px solid var(--border);border-radius:10px;margin:8px 0;padding:12px;overflow-wrap:anywhere}.sv27-match summary{cursor:pointer}.sv27-cal-logo{width:22px;height:22px;object-fit:contain;vertical-align:middle;margin:0 5px}@media(max-width:550px){.sv27-cal-grid button{font-size:10px;padding:6px 1px}.sv27-cal-row input,.sv27-cal-row select{flex:1;min-width:130px}}';document.head.append(css);
 const previous=renderPlayer;
 renderPlayer=function(...args){stop();previous(...args);if(active!=='📅 Terminarz')return;const view=document.getElementById('view');if(!view)return;const legacy=el('details',null,'card');legacy.append(el('summary','Starszy terminarz i typy — osobne dane'));legacy.append(el('p','Tutaj znajdziesz wcześniejsze mecze i historię typów. Publiczny terminarz powyżej służy do sprawdzania spotkań i wyników.','muted'));while(view.firstChild)legacy.append(view.firstChild);const root=el('section',null,'card');root.id='sv27-calendar';view.append(root,legacy);currentRoot=root;state.page=0;load();timer=setInterval(refreshVisible,10000);if(typeof db!=='undefined'&&db&&typeof db.channel==='function'){try{channel=db.channel('sv27-calendar-changes').on('postgres_changes',{event:'*',schema:'public',table:'fz26_fixtures'},refreshVisible).subscribe()}catch{channel=null}}};
 window.addEventListener('beforeunload',stop);
})();
