(()=>{'use strict';
// Presentation helper only. Official standings require trusted server-side statistics.
const rules=Object.freeze({minutesShort:1,minutesLong:2,goal:{G:10,D:6,M:5,F:4},assist:3,cleanSheet:{G:4,D:4,M:1,F:0},savesPer3:1,penaltySave:5,yellow:-1,red:-3,ownGoal:-2,penaltyMiss:-2,concededPer2:-1});
const n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
function points(s={}){const pos=s.position;if(!['G','D','M','F'].includes(pos))return null;if((pos==='G'||pos==='D')&&(s.conceded===null||s.conceded===undefined||!Number.isFinite(Number(s.conceded))))return null;const minutes=n(s.minutes);let score=minutes>=60?2:minutes>0?1:0;score+=n(s.goals)*rules.goal[pos]+n(s.assists)*3;score+=minutes>=60&&s.cleanSheet===true?rules.cleanSheet[pos]:0;if(pos==='G')score+=Math.floor(n(s.saves)/3)+n(s.penaltySaves)*5;if(pos==='G'||pos==='D')score-=Math.floor(n(s.conceded)/2);score-=n(s.yellow)+n(s.red)*3+n(s.ownGoals)*2+n(s.penaltyMisses)*2;score+=n(s.bonus);return score;}
window.FZ26FantasyEngine={score:points,rules,locale:()=>localStorage.getItem('fz26_locale')==='en'?'en':'pl'};
})();
