(()=>{'use strict';
const translations={
 pl:{title:'Quiz sportowy tygodnia',intro:'Pięć pytań sportowych, jedna próba na konto w tygodniu UTC. Każda poprawna odpowiedź daje 20 wirtualnych monet.',level:'Poziom',levels:['Łatwy','Średni','Trudny','Ekspert'],start:'Rozpocznij quiz',submit:'Wyślij odpowiedzi',loading:'Ładowanie…',done:'Quiz zakończony',score:'Wynik',reward:'Nagroda',week:'Tydzień od',question:'Pytanie',choose:'Wybierz odpowiedź',missing:'Odpowiedz na wszystkie pytania.',error:'Quiz niedostępny',retry:'Spróbuj ponownie',note:'Pytania i nagrody zapisują się na koncie. Pula wymaga regularnego uzupełniania zatwierdzonymi pytaniami.'},
 en:{title:'Weekly sports quiz',intro:'Five sports questions, one attempt per account per UTC week. Each correct answer awards 20 virtual coins.',level:'Difficulty',levels:['Easy','Medium','Hard','Expert'],start:'Start quiz',submit:'Submit answers',loading:'Loading…',done:'Quiz complete',score:'Score',reward:'Reward',week:'Week starting',question:'Question',choose:'Choose an answer',missing:'Answer every question.',error:'Quiz unavailable',retry:'Retry',note:'Questions and rewards are saved to your account. The question pool must be regularly replenished with reviewed questions.'}
};
function node(tag,text,parent){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(parent)parent.append(el);return el}
function button(text,parent,fn){const el=node('button',text,parent);el.type='button';el.addEventListener('click',fn);return el}
function render(root,api){if(!root)return;const l=localStorage.getItem('sportivra_lang')==='en'?'en':'pl',t=translations[l];let data=null,busy=false;
 function draw(){root.replaceChildren();node('h2','🎯 '+t.title,root);node('p',t.intro,root);const area=node('div',undefined,root);node('small',t.note,root);
 if(!data){node('p',t.loading,area);return}
 if(data.error){node('p',t.error+': '+data.error,area);button(t.retry,area,load);return}
 node('p',`${t.week}: ${data.week}`,area);
 if(data.state==='completed'){node('p',`${t.done}. ${t.score}: ${data.score}/5 · ${t.reward}: ${data.reward} 🪙`,area);return}
 if(data.state==='new'){const label=node('label',t.level+' ',area),select=node('select',undefined,label);t.levels.forEach((name,i)=>{const opt=node('option',name,select);opt.value=String(i)});button(t.start,area,async e=>{if(busy)return;busy=true;e.currentTarget.disabled=true;try{data=await api.rpc('sv_quiz_start',{p_level:Number(select.value)});draw()}catch(err){data={error:err.message};draw()}finally{busy=false}});return}
 if(data.state==='started'){const form=node('form',undefined,area);data.questions.forEach((q,i)=>{const field=node('fieldset',undefined,form);node('legend',`${t.question} ${i+1}/5: ${q[l]}`,field);q['choices_'+l].forEach((option,j)=>{const label=node('label',undefined,field);label.style.display='block';const radio=node('input',undefined,label);radio.type='radio';radio.name='question'+i;radio.value=String(j);label.append(document.createTextNode(' '+option))})});const status=node('p','',form);status.setAttribute('role','status');const submit=node('button',t.submit,form);submit.type='submit';form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const answers=data.questions.map((_,i)=>form.querySelector(`input[name="question${i}"]:checked`)).map(x=>x?Number(x.value):null);if(answers.some(x=>x===null)){status.textContent=t.missing;return}busy=true;submit.disabled=true;try{data=await api.rpc('sv_quiz_submit',{p_answers:answers});if(api.onReward)api.onReward(data);draw()}catch(err){status.textContent=t.error+': '+err.message;submit.disabled=false}finally{busy=false}});return}
 }
 async function load(){data=null;draw();try{data=await api.rpc('sv_quiz_status');draw()}catch(err){data={error:err.message};draw()}}
 if(!api||typeof api.rpc!=='function'){data={error:'Supabase'};draw()}else load();
}
window.SV26WeeklyArcade={render};
})();
