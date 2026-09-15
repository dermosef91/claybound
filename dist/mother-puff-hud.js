import {motherPuffStatus,MOTHER_PUFF} from './mother-puff-rules.js';

export function updateMotherHUD(game,root,mist,visible){
  const b=game.level.boss,p=game.player;
  const shown=!!(visible&&b&&p.x>b.triggerX-7&&p.x<b.right+8);
  root.classList.toggle('hidden',!shown);
  mist.classList.toggle('hidden',!(shown&&p.sporeSlow&&game.status==='playing'));
  if(!shown)return;
  root.dataset.state=b.state;
  const remaining=MOTHER_PUFF.hits-b.hits;
  const hits=root.querySelector('[data-boss-hits]'),status=root.querySelector('[data-boss-status]');
  const count=b.state==='defeated'?'Resting':`${remaining} / 3`,message=motherPuffStatus(b,p);
  if(hits.textContent!==count)hits.textContent=count;
  if(status.textContent!==message)status.textContent=message;
  root.querySelectorAll('[data-boss-pip]').forEach((e,i)=>e.classList.toggle('spent',i>=remaining));
  root.setAttribute('aria-label',`Mother Puff. ${remaining} stomps remaining.`);
}
