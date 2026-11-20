/* One entry point for the new tickets and the existing ticket history. */
(()=>{'use strict';
 const launch=document.getElementById('fz-bet-btn');if(!launch||!window.SV27Bets)return;
 const openLegacy=launch.onclick;launch.textContent='⚽ Kupony';
 launch.onclick=async function(){
  if(document.getElementById('sv27-bets-overlay'))return;
  const overlay=document.createElement('section');overlay.id='sv27-bets-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Kupony');
  overlay.style.cssText='position:fixed;inset:0;z-index:100050;background:#08101f;color:#fff;overflow:auto;padding:20px';
  const wrap=document.createElement('div');wrap.style.cssText='max-width:960px;margin:auto';overlay.append(wrap);
  const close=document.createElement('button');close.type='button';close.textContent='✕ Zamknij';
  const old=document.createElement('button');old.type='button';old.textContent='Starsze kupony';old.style.marginLeft='8px';
  const target=document.createElement('div');target.textContent='Ładowanie…';wrap.append(close,old,target);document.body.append(overlay);
  let cleanup=null,closed=false;
  function dismiss(){closed=true;if(cleanup)cleanup();overlay.remove()}
  close.onclick=dismiss;old.onclick=()=>{dismiss();if(typeof openLegacy==='function')openLegacy.call(launch)};
  try{
   const client=typeof db==='undefined'?null:db;
   cleanup=await window.SV27Bets.mount(target,{db:client,onWalletChanged:()=>{if(typeof refresh==='function')Promise.resolve(refresh()).catch(()=>{})}});
   if(closed&&cleanup)cleanup();
  }catch(e){if(!closed)target.textContent='Nie udało się otworzyć kuponów: '+(e?.message||String(e))}
 };
})();
