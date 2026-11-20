/* SPORTIVRA 2.7 event schedule. Personal participation and wallet awards are server-side RPCs. */
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 const button=(text,fn)=>{const b=element('button',text);b.type='button';b.addEventListener('click',fn);return b};
 const start=byId('fz25event-launch');if(!start)return;
 start.textContent='🎪 Eventy';
 start.onclick=async()=>{
  if(byId('fz27-events'))return;
  const root=element('section',null,'fz25event-shell');root.id='fz27-events';root.setAttribute('role','dialog');root.setAttribute('aria-label','Eventy');
  Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'100050',overflow:'auto',background:'#07101d',color:'#f5f8ff',padding:'20px',maxWidth:'none'});
  const body=element('div');body.style.cssText='max-width:960px;margin:auto';root.append(body);
  const title=element('h1','🎪 Eventy');const status=element('p','Wczytywanie…');status.setAttribute('role','status');const list=element('div');
  const close=button('✕ Zamknij',()=>{clearInterval(countdown);clearInterval(poll);root.remove()});body.append(close,title,status,list);document.body.append(root);
  let data=[],mine=new Map(),loading=false;
  const timeText=target=>{const diff=Math.max(0,Math.floor((target-Date.now())/1000));const d=Math.floor(diff/86400),h=Math.floor(diff%86400/3600),m=Math.floor(diff%3600/60),s=diff%60;return (d?d+' d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
  function render(){if(!root.isConnected)return;list.replaceChildren();const now=Date.now();
   const groups=[['🟢 Trwają',[]],['📅 Nadchodzą',[]],['🏁 Zakończone',[]],['🎁 Nieodebrane nagrody',[]]];
   for(const ev of data){const a=ev.starts_at?Date.parse(ev.starts_at):null,z=ev.ends_at?Date.parse(ev.ends_at):null;if(a!=null&&!Number.isFinite(a)||z!=null&&!Number.isFinite(z))continue;const part=mine.get(ev.id);if(ev.cancelled_at||!ev.enabled){if(part&&!part.claimed_at)groups[3][1].push([ev,3,a,z]);continue}const state=a!=null&&now<a?1:z!=null&&now>=z?2:0;groups[state][1].push([ev,state,a,z]);}
   for(const [label,events] of groups){const sec=element('section');sec.append(element('h2',label));if(!events.length)sec.append(element('p','Brak wydarzeń.'));
    for(const [ev,state,a,z] of events){const card=element('article',null,'card');card.append(element('h3',ev.title||ev.id));if(ev.description)card.append(element('p',ev.description));
     const date=d=>d==null?'brak daty':new Date(d).toLocaleString();card.append(element('p','Początek: '+date(a)+' • Koniec: '+date(z)));
     if(state===1&&a!=null){const el=element('p');el.dataset.countdown=String(a);el.dataset.prefix='Do rozpoczęcia: ';card.append(el)}
     if(state===0&&z!=null){const el=element('p');el.dataset.countdown=String(z);el.dataset.prefix='Do zakończenia: ';card.append(el)}
     const row=mine.get(ev.id),reward=row?.reward_snapshot??ev.reward_coins??0;
     if(row){card.append(element('p','Udział: zapisany • Misja: dołącz do eventu — ukończona • Nagroda: '+reward+' monet'));
      if(row.claimed_at)card.append(element('p','Nagroda została odebrana.'));
      else {const claim=button('Odbierz nagrodę',async()=>{claim.disabled=true;status.textContent='Odbieranie…';try{const {data:result,error}=await db.rpc('fz27_event_claim',{p_event:ev.id});if(error)throw error;status.textContent='Przyznano '+result.reward+' monet. Saldo: '+result.coins+'.';await load(false)}catch(e){status.textContent='Nie udało się odebrać nagrody: '+(e.message||String(e));claim.disabled=false}});card.append(claim)}
     }else if(state===0){if(a==null||z==null)card.append(element('p','Udział wymaga ustawienia dat przez administratora.'));else if(typeof user==='undefined'||!user)card.append(element('p','Zaloguj się, aby dołączyć.'));else{const join=button('Dołącz',async()=>{join.disabled=true;status.textContent='Zapisywanie…';try{const {error}=await db.rpc('fz27_event_join',{p_event:ev.id});if(error)throw error;status.textContent='Dołączono do wydarzenia.';await load(false)}catch(e){status.textContent='Nie udało się dołączyć: '+(e.message||String(e));join.disabled=false}});card.append(join)}}
     sec.append(card)
    }list.append(sec)
   }tick()
  }
  function tick(){for(const el of root.querySelectorAll('[data-countdown]'))el.textContent=el.dataset.prefix+timeText(Number(el.dataset.countdown))}
  async function load(show=true){if(loading||!root.isConnected)return;loading=true;if(show)status.textContent='Wczytywanie…';try{
    if(typeof db==='undefined'||!db)throw Error('Brak połączenia z Supabase. Sprawdź konfigurację lub zaloguj się.');
    const result=await db.from('fz25_events').select('id,title,category,enabled,starts_at,ends_at,description,reward_coins,cancelled_at').order('starts_at',{ascending:true});if(result.error)throw result.error;
    data=result.data||[];mine=new Map();if(typeof user!=='undefined'&&user){const parts=await db.from('fz27_event_participants').select('event_id,claimed_at,reward_snapshot').eq('user_id',user.id);if(parts.error)throw parts.error;for(const part of parts.data||[])mine.set(part.event_id,part)}
    if(show)status.textContent='Godziny podano w lokalnej strefie czasowej urządzenia.';render()
   }catch(e){status.textContent='Nie udało się wczytać eventów: '+(e.message||String(e))+'. Sprawdź połączenie i migrację 27_EVENTS.sql.'}finally{loading=false}}
  const countdown=setInterval(()=>{if(!root.isConnected){clearInterval(countdown);return}tick();const n=Date.now();if(data.some(e=>[e.starts_at,e.ends_at].some(v=>v&&Math.abs(Date.parse(v)-n)<1100)))render()},1000);
  const poll=setInterval(()=>{if(!root.isConnected){clearInterval(poll);return}if(!document.hidden)load(false)},30000);await load();
 };
})();
