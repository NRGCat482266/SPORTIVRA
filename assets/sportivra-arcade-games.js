(()=>{'use strict';
const K='sportivra_arcade_games_v1';
const load=()=>{try{return {...{plays:0,wins:0,streak:0,bestStreak:0,scores:{},history:[]},...JSON.parse(localStorage.getItem(K)||'{}')}}catch{return {plays:0,wins:0,streak:0,bestStreak:0,scores:{},history:[]}}};
let s=load(), game='math', current=null, locked=false;
const save=()=>localStorage.setItem(K,JSON.stringify(s));
const r=n=>Math.floor(Math.random()*n);
const games={math:{pl:'Szybka matematyka',en:'Quick math'},guess:{pl:'Zgadnij liczbę',en:'Guess the number'},trivia:{pl:'Quiz sportowy',en:'Sports trivia'}};
const questions=[
{pl:'Ilu zawodników jednej drużyny gra na boisku w piłce nożnej?',en:'How many players per team are on a football pitch?',a:['11','9','7'],c:0},
{pl:'Ile punktów wart jest rzut wolny w koszykówce?',en:'How many points is a basketball free throw worth?',a:['1','2','3'],c:0},
{pl:'Ile setów maksymalnie rozgrywa się w siatkówce halowej?',en:'What is the maximum number of sets in indoor volleyball?',a:['3','4','5'],c:2},
{pl:'Co oznacza pole position w F1?',en:'What does pole position mean in F1?',a:{pl:['Pierwsze miejsce na starcie','Najszybszy pit stop','Najwięcej punktów'],en:['First place on the starting grid','Fastest pit stop','Most points']},c:0},
{pl:'Ile minut trwa podstawowy czas meczu piłki ręcznej seniorów?',en:'How long is a standard senior handball match?',a:['40','60','90'],c:1},
{pl:'Ile punktów daje rzut zza linii trzech punktów w koszykówce?',en:'How many points is a shot beyond the arc worth?',a:['2','3','4'],c:1}
];
const achievements=[['first',1,'plays','Pierwsza gra','First game'],['ten',10,'plays','10 rozgrywek','10 games'],['winner',1,'wins','Pierwsza wygrana','First win'],['five',5,'wins','5 wygranych','5 wins'],['streak',3,'bestStreak','Seria 3 zwycięstw','3-win streak'],['master',10,'wins','Mistrz Arcade','Arcade master']];
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lang(){return localStorage.getItem('sportivra_language')==='en'?'en':'pl'}
function start(){locked=false;const l=lang();if(game==='math'){const a=1+r(15),b=1+r(15);current={prompt:`${a} + ${b} = ?`,answer:a+b,choices:[a+b,a+b+1,a+b+3].sort(()=>Math.random()-.5)}}
else if(game==='guess'){const n=1+r(5);current={prompt:l==='pl'?'Wybierz ukrytą liczbę od 1 do 5':'Choose the hidden number from 1 to 5',answer:n,choices:[1,2,3,4,5]}}
else{const q=questions[r(questions.length)];current={prompt:q[l],answer:q.c,choices:Array.isArray(q.a)?q.a:q.a[l],quiz:true}}draw()}
function draw(){const root=document.getElementById('sv26-arcade-root');if(!root)return;const l=lang();const t=(pl,en)=>l==='pl'?pl:en;
root.innerHTML=`<div class="panel"><h2>🎮 ${t('SPORTIVRA ARCADE — gry','SPORTIVRA ARCADE — games')}</h2><p>${t('3 gry • osiągnięcia • lokalny zapis. Bez monet i XP.','3 games • achievements • local save. No coins or XP.')}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(games).map(([id,n])=>`<button type="button" data-game="${id}" aria-pressed="${id===game}">${esc(n[l])}</button>`).join('')}</div><h3>${esc(current?.prompt||'')}</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${(current?.choices||[]).map((a,i)=>`<button type="button" data-answer="${i}" ${locked?'disabled':''}>${esc(a)}</button>`).join('')}</div><p id="sv26-arcade-result" role="status"></p><button type="button" data-next>${t('Nowa runda','New round')}</button></div><div class="panel"><h3>🏅 ${t('Osiągnięcia','Achievements')}</h3><p>${t('Rozgrywki','Games')}: ${s.plays} • ${t('Wygrane','Wins')}: ${s.wins} • ${t('Najlepsza seria','Best streak')}: ${s.bestStreak}</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">${achievements.map(([id,min,key,pl,en])=>`<div style="padding:10px;border:1px solid #556;border-radius:8px">${s[key]>=min?'🏆':'🔒'} ${esc(t(pl,en))}</div>`).join('')}</div><p style="font-size:12px;opacity:.8">${t('Osiągnięcia zapisują się na tym urządzeniu; synchronizacja między urządzeniami wymaga późniejszego wdrożenia Supabase.','Achievements are stored on this device; cross-device sync requires later Supabase deployment.')}</p></div>`;
root.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{game=b.dataset.game;start()});root.querySelector('[data-next]').onclick=start;
root.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(locked)return;locked=true;const idx=Number(b.dataset.answer);const correct=current.quiz?idx===current.answer:Number(current.choices[idx])===current.answer;s.plays++;if(correct){s.wins++;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak)}else s.streak=0;s.scores[game]=(s.scores[game]||0)+(correct?1:0);s.history.unshift({game,correct,at:new Date().toISOString()});s.history=s.history.slice(0,50);save();draw();const msg=document.getElementById('sv26-arcade-result');if(msg)msg.textContent=correct?t('✅ Poprawnie!','✅ Correct!'):t('❌ Niepoprawnie.','❌ Incorrect.');root.querySelectorAll('[data-answer]').forEach(el=>el.disabled=true)})}
function mount(el){if(!el)return;el.id='sv26-arcade-root';start()}
window.SV26ArcadeGames={mount};
})();
