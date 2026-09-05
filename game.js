(()=>{
"use strict";
const STORAGE_KEY="mahouMergeSave_v1";
const MAX_STAGE=100, STAGES_PER_LEVEL=10, PLAYER_COLS=7, PLAYER_ROWS=3, PLAYER_SIZE=21, ENEMY_COLS=7, ENEMY_ROWS=8;
const defaultSave={accountLevel:1,accountXp:0,gems:0,coreLevel:1,stage:1,collectedUnits:0};
let save=loadSave(),state=null,selectedIndex=null,dragIndex=null,dragOverIndex=null,activePointerId=null;
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function loadSave(){try{return {...defaultSave,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}}catch{return {...defaultSave}}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(save));updateHome();updateBase()}
function xpNeeded(l){return 100+(l-1)*35}
function stageData(n){const world=Math.ceil(n/STAGES_PER_LEVEL),local=((n-1)%STAGES_PER_LEVEL)+1,waves=3+Math.floor((n-1)/20),enemyHp=Math.round(24*Math.pow(1.075,n-1)),enemyCount=2+Math.min(5,Math.floor((n-1)/12));return{world,local,waves,enemyHp,enemyCount,boss:local===STAGES_PER_LEVEL}}
function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(id).classList.add("active")}
function updateHome(){if(!$('home-account-level'))return;$('home-account-level').textContent=save.accountLevel;$('home-xp-bar').style.width=`${Math.min(100,save.accountXp/xpNeeded(save.accountLevel)*100)}%`}
function updateBase(){if(!$('base-account-level'))return;$('base-account-level').textContent=save.accountLevel;const n=xpNeeded(save.accountLevel);$('base-xp-bar').style.width=`${Math.min(100,save.accountXp/n*100)}%`;$('base-xp-text').textContent=`${save.accountXp} / ${n} XP`;$('core-level').textContent=save.coreLevel;$('core-hp-bonus').textContent=`${(save.coreLevel-1)*8}%`}
function grantXp(amount){save.accountXp+=amount;while(save.accountXp>=xpNeeded(save.accountLevel)){save.accountXp-=xpNeeded(save.accountLevel);save.accountLevel++;log(`Account Level ${save.accountLevel}!`)}persist()}
function newRun(stageNum){const d=stageData(stageNum);state={stage:stageNum,data:d,wave:1,turn:1,baseHp:100+(save.coreLevel-1)*8,maxBaseHp:100+(save.coreLevel-1)*8,enemies:[],board:Array(PLAYER_SIZE).fill(null),cleared:false,resolving:false,pickup:null,kills:0};selectedIndex=null;dragIndex=null;dragOverIndex=null;activePointerId=null;$('world-label').textContent=`LEVEL ${d.world} · 10 STAGES`;$('stage-label').textContent=`STAGE ${d.local} / 10`;
// Start with three level-1 girls in the bottom row, one in each of the first three columns.
state.board[18]={level:1,element:"🌱"};state.board[19]={level:1,element:"🌱"};state.board[20]={level:1,element:"🌱"};
showScreen('game-screen');spawnWave();renderBoard();updateHud();updateTurnButton();log('Move a Magical Girl to end the turn. Same-level merges are free actions.')}
function renderBoard(){const grid=$('grid');grid.innerHTML='';state.board.forEach((unit,i)=>{const slot=document.createElement('div');slot.className='slot';slot.dataset.index=i;slot.addEventListener('click',()=>selectUnit(i));slot.addEventListener('pointerup',e=>{if(dragIndex!==null&&dragIndex!==i){e.preventDefault();moveUnit(dragIndex,i)}});if(unit){const u=document.createElement('button');u.className=`unit level${Math.min(unit.level,4)}`;u.type='button';u.innerHTML=`<span>${unit.element}</span><small>Lv.${unit.level}</small>`;u.addEventListener('click',e=>{e.stopPropagation();selectUnit(i)});u.addEventListener('pointerdown',e=>startPointerDrag(e,i,u));u.addEventListener('dragstart',e=>{dragIndex=i;u.classList.add('dragging');e.dataTransfer?.setData('text/plain',String(i))});u.addEventListener('dragend',()=>{dragIndex=null;clearDragOver();u.classList.remove('dragging')});slot.appendChild(u)}grid.appendChild(slot)});renderPickup();highlightSelected()}
function startPointerDrag(e,i,u){if(state.resolving||state.cleared)return;e.preventDefault();activePointerId=e.pointerId;dragIndex=i;selectedIndex=i;u.classList.add('dragging');try{u.setPointerCapture(e.pointerId)}catch{}markDragOver(i)}
function pointerMove(e){if(dragIndex===null||e.pointerId!==activePointerId)return;e.preventDefault();const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.slot');if(el&&$('grid').contains(el))markDragOver(Number(el.dataset.index))}
function pointerUp(e){if(dragIndex===null||e.pointerId!==activePointerId)return;e.preventDefault();const from=dragIndex;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.slot');const to=el&&$('grid').contains(el)?Number(el.dataset.index):from;dragIndex=null;activePointerId=null;clearDragOver();if(to!==from)moveUnit(from,to);else renderBoard()}
document.addEventListener('pointermove',pointerMove,{passive:false});document.addEventListener('pointerup',pointerUp,{passive:false});document.addEventListener('pointercancel',()=>{dragIndex=null;activePointerId=null;clearDragOver();if(state&&!state.cleared)renderBoard()});
function markDragOver(i){if(dragOverIndex===i)return;clearDragOver();dragOverIndex=i;$('grid').children[i]?.classList.add('drag-over')}
function clearDragOver(){if(dragOverIndex!==null){$('grid').children[dragOverIndex]?.classList.remove('drag-over');dragOverIndex=null}}
function moveUnit(from,to){if(!state||state.cleared||state.resolving||from==null||to==null||from===to||!state.board[from])return;const a=state.board[from],b=state.board[to];if(b&&a.level===b.level){const level=a.level+1;state.board[to]={level,element:elementForLevel(level)};state.board[from]=null;selectedIndex=null;renderBoard();log(`Merge! Lv.${a.level} + Lv.${b.level} → Lv.${level}`);return}
// A move or swap ends the turn. A merge above is the only free board action.
state.board[to]=a;state.board[from]=b||null;selectedIndex=null;renderBoard();log('Magical Girl moved. Attacks are launching...');endTurn()}
function selectUnit(i){if(state.resolving||state.cleared||!state.board[i])return;if(selectedIndex===null){selectedIndex=i;renderBoard();return}if(selectedIndex===i){selectedIndex=null;renderBoard();return}moveUnit(selectedIndex,i)}
function highlightSelected(){if(selectedIndex!==null)$('grid').children[selectedIndex]?.classList.add('selected-slot')}
function elementForLevel(lvl){const els=['🌱','🔥','💧','⚡','🌙','🌟'];return els[Math.min(els.length-1,Math.floor((lvl-1)/2))]}
function spawnWave(){
  state.enemies=[];
  const maxSpawn=ENEMY_COLS;
  const count=Math.min(maxSpawn,state.data.enemyCount+(state.wave-1));
  // Every enemy is spawned on the very top row, but in different columns.
  // If a wave contains fewer than 7 enemies, choose distinct columns at random.
  const cols=Array.from({length:ENEMY_COLS},(_,i)=>i).sort(()=>Math.random()-.5).slice(0,count);
  cols.forEach((col,i)=>{
    const boss=state.data.boss&&i===count-1;
    const hp=state.data.enemyHp*(1+(state.wave-1)*.28)*(boss?2.4:1);
    state.enemies.push({id:`e${Date.now()}-${i}-${Math.random()}`,hp,maxHp:hp,boss,emoji:boss?'👑':'👾',row:0,col});
  });
  renderEnemies();updateHud();
}
function renderEnemies(){const lane=$('enemy-lane');lane.innerHTML='';state.enemies.forEach(e=>{const wrap=document.createElement('div');wrap.className=`enemy-wrap${e.boss?' boss':''}`;wrap.dataset.enemyId=e.id;wrap.style.gridRow=e.row+1;wrap.style.gridColumn=e.col+1;const pct=clamp(e.hp/e.maxHp*100,0,100);wrap.innerHTML=`<div class="enemy-hp"><div style="width:${pct}%"></div></div><div class="enemy-hp-text">${Math.max(0,Math.ceil(e.hp))}/${Math.ceil(e.maxHp)}</div><div class="enemy">${e.emoji}</div>`;lane.appendChild(wrap)})}
function findTarget(col){return state.enemies.filter(e=>e.col===col).sort((a,b)=>b.row-a.row)[0]||null}
function fireProjectile(fromIndex,enemyId,damage){const unit=$('grid').children[fromIndex]?.querySelector('.unit'),enemy=document.querySelector(`[data-enemy-id="${CSS.escape(enemyId)}"] .enemy`),field=$('battlefield');if(!unit||!enemy||!field){applyDamage(enemyId,damage);return Promise.resolve()}const a=unit.getBoundingClientRect(),b=enemy.getBoundingClientRect(),c=field.getBoundingClientRect(),p=document.createElement('div');p.className='projectile';$('projectiles').appendChild(p);const sx=a.left-c.left+a.width/2-5,sy=a.top-c.top+a.height/2-5,tx=b.left-c.left+b.width/2-5,ty=b.top-c.top+b.height/2-5;p.style.left=`${sx}px`;p.style.top=`${sy}px`;requestAnimationFrame(()=>p.style.transform=`translate(${tx-sx}px,${ty-sy}px)`);return new Promise(resolve=>setTimeout(()=>{p.classList.add('hit');applyDamage(enemyId,damage);setTimeout(()=>p.remove(),100);resolve()},360))}
function applyDamage(enemyId,damage){if(!state||state.cleared)return;const e=state.enemies.find(x=>x.id===enemyId);if(!e)return;e.hp-=damage;renderEnemies();const el=document.querySelector(`[data-enemy-id="${CSS.escape(enemyId)}"] .enemy`);if(el){const f=$('battlefield').getBoundingClientRect(),r=el.getBoundingClientRect();showDamage(r.left-f.left+r.width/2,r.top-f.top,f)} }
function showDamage(x,y){const d=document.createElement('div');d.className='damage-pop';d.textContent='-'+Math.max(1,Math.round(1));d.style.left=`${x-10}px`;d.style.top=`${y-5}px`;$('battlefield').appendChild(d);setTimeout(()=>d.remove(),550)}
async function attackPhase(){const shots=[];for(let row=0;row<PLAYER_ROWS;row++){for(let col=0;col<PLAYER_COLS;col++){const unit=state.board[row*PLAYER_COLS+col];if(!unit)continue;const target=findTarget(col);if(!target)continue;shots.push(fireProjectile(row*PLAYER_COLS+col,target.id,Math.pow(unit.level,1.55)*4.5))}}if(shots.length)log(`${shots.length} projectile${shots.length===1?'':'s'} launched!`);await Promise.all(shots)}
function cleanupEnemies(){
  const defeated=state.enemies.filter(e=>e.hp<=0).length;
  if(defeated){
    state.kills+=defeated;
    for(let i=0;i<defeated;i++){
      if(state.kills%2===0)maybeRewardAlly();
    }
  }
  state.enemies=state.enemies.filter(e=>e.hp>0);
  renderEnemies();
}
function maybeRewardAlly(){
  const empty=[];
  state.board.forEach((u,i)=>{if(!u)empty.push(i)});
  if(!empty.length)return;
  if(Math.random()<0.5){
    const index=empty[Math.floor(Math.random()*empty.length)];
    state.board[index]={level:1,element:'🌱'};
    save.collectedUnits=(save.collectedUnits||0)+1;
    persist();renderBoard();
    log(`✨ A new ally joined after ${state.kills} enemies were defeated!`);
  }else{
    log(`Two enemies defeated! No new ally this time.`);
  }
}
function enemyAdvancePhase(){
  let damage=0,breached=0;
  state.enemies.forEach(e=>{
    e.row++;
    const options=[e.col];
    if(e.col>0)options.push(e.col-1);
    if(e.col<ENEMY_COLS-1)options.push(e.col+1);
    // Every enemy rolls independently, so two enemies can choose different paths.
    e.col=options[Math.floor(Math.random()*options.length)];
  });
  state.enemies=state.enemies.filter(e=>{
    if(e.row>=ENEMY_ROWS){damage+=e.boss?8:4;breached++;return false}
    return true;
  });
  state.baseHp=clamp(state.baseHp-damage,0,state.maxBaseHp);
  renderEnemies();
  if(breached)log(`${breached} enemy${breached===1?'':'ies'} reached the divider and dealt ${damage} damage.`);
}
async function endTurn(){if(state.cleared||state.resolving)return;state.resolving=true;updateTurnButton();state.turn++;await attackPhase();if(state.cleared){state.resolving=false;updateTurnButton();return}cleanupEnemies();if(state.enemies.length===0){if(state.wave<state.data.waves){state.wave++;spawnWave();maybeSpawnPickup();state.resolving=false;updateHud();updateTurnButton()}else{state.resolving=false;updateTurnButton();victory()}return}enemyAdvancePhase();if(state.baseHp<=0){state.resolving=false;updateTurnButton();defeat();return}if(state.enemies.length===0){if(state.wave<state.data.waves){state.wave++;spawnWave();maybeSpawnPickup()}else{state.resolving=false;updateTurnButton();victory();return}}state.resolving=false;updateHud();updateTurnButton()}
function updateTurnButton(){const b=$("end-turn-button");if(!b)return;b.disabled=!!state?.resolving||!!state?.cleared;b.textContent=state?.resolving?"RESOLVING…":"END TURN"}
function maybeSpawnPickup(){state.pickup=null;if(Math.random()>.38)return;const empty=[];state.board.forEach((u,i)=>{if(!u)empty.push(i)});if(!empty.length)return;const index=empty[Math.floor(Math.random()*empty.length)],type=Math.random()<.55?'chest':'unit';state.pickup={type,index};renderPickup();log(type==='chest'?'A treasure chest appeared on the field!':'A new Magical Girl appeared on the field!')}
function renderPickup(){document.querySelectorAll('.pickup').forEach(x=>x.remove());if(!state?.pickup)return;const slot=$('grid').children[state.pickup.index];if(!slot)return;const p=document.createElement('button');p.className='pickup';p.type='button';p.textContent=state.pickup.type==='chest'?'🎁':'✨';p.onclick=e=>{e.stopPropagation();collectPickup()};slot.appendChild(p)}
function collectPickup(){if(!state?.pickup||state.resolving)return;const {type,index}=state.pickup;if(type==='chest'){const gems=5+Math.floor(Math.random()*6);save.gems+=gems;grantXp(12);log(`Chest opened! +${gems} gems.`)}else{state.board[index]={level:1,element:'🌱'};save.collectedUnits=(save.collectedUnits||0)+1;log('New Magical Girl added to the field!')}state.pickup=null;persist();renderBoard();updateHud()}
function updateHud(){if(!state)return;$('wave-label').textContent=`WAVE ${state.wave}/${state.data.waves}`;$('turn-label').textContent=`TURN ${state.turn}`;$('base-hp-bar').style.width=`${clamp(state.baseHp/state.maxBaseHp*100,0,100)}%`;$('gems-label').textContent=save.gems;$('account-label').textContent=save.accountLevel}
function victory(){state.cleared=true;const reward=40+state.stage*4;save.gems+=5+Math.floor(state.stage/10);grantXp(reward);save.stage=Math.min(MAX_STAGE,Math.max(save.stage,state.stage+1));persist();$('victory-title').textContent=state.stage===MAX_STAGE?'100 Stages Complete!':'Stage Clear!';$('victory-text').textContent=`You earned ${reward} account XP and gems.`;$('next-stage-button').textContent=state.stage===MAX_STAGE?'PLAY AGAIN':`STAGE ${state.stage+1}`;$('victory-modal').classList.remove('hidden')}
function defeat(){state.cleared=true;$('victory-title').textContent='Base Defeated';$('victory-text').textContent='The Crystal Heart fell. Your account progress is safe.';$('next-stage-button').textContent='TRY AGAIN';$('victory-modal').classList.remove('hidden')}
function log(text){$('combat-log').textContent=text}
$('start-button').onclick=()=>newRun(save.stage);$('end-turn-button').onclick=()=>endTurn();$('base-button').onclick=()=>{updateBase();showScreen('base-screen')};$('back-button').onclick=()=>{$('victory-modal').classList.add('hidden');showScreen('home-screen')};$('base-back-button').onclick=()=>showScreen('home-screen');$('upgrade-core-button').onclick=()=>{const cost=save.coreLevel*20;if(save.gems>=cost){save.gems-=cost;save.coreLevel++;persist()}else alert(`You need ${cost} gems.`)};$('next-stage-button').onclick=()=>{$('victory-modal').classList.add('hidden');newRun(state.stage===MAX_STAGE?1:state.stage+1)};
updateHome();updateBase();$('offline-status').textContent=navigator.onLine?'Offline-ready • saved on this device':'Offline mode';window.addEventListener('online',()=>{$('offline-status').textContent='Connected • still playable offline'});window.addEventListener('offline',()=>{$('offline-status').textContent='Offline mode • game is still playable offline'});
})();
