(() => {
  "use strict";

  const STORAGE_KEY = "magicalMergeSave_v4";
  const MAX_STAGE = 100;
  const SKILLS = [
    {id:"arcane",name:"Arcane Burst",icon:"⚡",description:"Damage every enemy.",unlockStage:1},
    {id:"guard",name:"Crystal Guard",icon:"🛡️",description:"Restore 25% of maximum base HP.",unlockStage:5},
    {id:"meteor",name:"Starfall",icon:"☄️",description:"Heavy damage to the strongest enemy.",unlockStage:10}
  ];
  const defaultSave={accountLevel:1,accountXp:0,gems:0,coreLevel:1,stage:1,collectedUnits:0};
  let save=loadSave(),state=null,selectedIndex=null,dragIndex=null;
  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function loadSave(){try{return {...defaultSave,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}}catch{return {...defaultSave}}}
  function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(save));updateHome();updateBase()}
  function stageData(n){const world=Math.ceil(n/10),local=((n-1)%10)+1,waves=3+Math.floor(n/20),enemyHp=Math.round(24*Math.pow(1.075,n-1)),enemyCount=2+Math.min(5,Math.floor((n-1)/12));return{world,local,waves,enemyHp,enemyCount,boss:local===10}}
  function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(id).classList.add("active")}
  function xpNeeded(l){return 100+(l-1)*35}
  function updateHome(){if(!$("home-account-level"))return;$("home-account-level").textContent=save.accountLevel;$("home-xp-bar").style.width=`${Math.min(100,save.accountXp/xpNeeded(save.accountLevel)*100)}%`}
  function updateBase(){if(!$("base-account-level"))return;$("base-account-level").textContent=save.accountLevel;const n=xpNeeded(save.accountLevel);$("base-xp-bar").style.width=`${Math.min(100,save.accountXp/n*100)}%`;$("base-xp-text").textContent=`${save.accountXp} / ${n} XP`;$("core-level").textContent=save.coreLevel;$("core-hp-bonus").textContent=`${(save.coreLevel-1)*8}%`}
  function grantXp(amount){save.accountXp+=amount;while(save.accountXp>=xpNeeded(save.accountLevel)){save.accountXp-=xpNeeded(save.accountLevel);save.accountLevel++;log(`Account Level ${save.accountLevel}!`)}persist()}
  function unlockedSkills(){return SKILLS.filter(s=>state.stage>=s.unlockStage)}

  function newRun(stageNum){
    const d=stageData(stageNum);
    state={stage:stageNum,data:d,wave:1,turn:1,baseHp:100+(save.coreLevel-1)*8,maxBaseHp:100+(save.coreLevel-1)*8,
      enemies:[],board:Array(21).fill(null),skillCooldowns:{arcane:0,guard:0,meteor:0},selectedSkill:"arcane",cleared:false,pickup:null};
    selectedIndex=null;dragIndex=null;
    $("world-label").textContent=`WORLD ${d.world}`;$("stage-label").textContent=`STAGE ${stageNum}`;
    // Start each lane with a unit near the base (right side).
    state.board[4]={level:1,element:"🌱"};state.board[11]={level:1,element:"🌱"};state.board[18]={level:1,element:"🌱"};
    spawnWave();renderBoard();updateSkillButtons();updateHud();log("Move your Magical Girls between the 21 spaces. Each lane attacks on its own.");
    showScreen("game-screen");
  }

  function renderBoard(){
    const grid=$("grid");grid.innerHTML="";
    state.board.forEach((unit,i)=>{
      const slot=document.createElement("div");slot.className="slot";slot.dataset.index=i;
      slot.addEventListener("dragover",e=>e.preventDefault());
      slot.addEventListener("drop",e=>{e.preventDefault();moveUnit(dragIndex,i)});
      slot.addEventListener("click",()=>selectUnit(i));
      if(unit){
        const u=document.createElement("button");u.className=`unit level${Math.min(unit.level,4)}`;u.draggable=true;
        u.innerHTML=`<span>${unit.element}</span><small>Lv.${unit.level}</small>`;
        u.addEventListener("dragstart",()=>{dragIndex=i;u.classList.add("dragging")});
        u.addEventListener("dragend",()=>{dragIndex=null;u.classList.remove("dragging")});
        u.addEventListener("pointerdown",()=>dragIndex=i);
        u.addEventListener("click",e=>{e.stopPropagation();selectUnit(i)});
        slot.appendChild(u);
      }
      grid.appendChild(slot);
    });
    renderPickup();highlightSelected();
  }

  function moveUnit(from,to){
    if(from==null||to==null||from===to||!state.board[from])return;
    const a=state.board[from],b=state.board[to];
    if(b&&a.level===b.level){const level=a.level+1;state.board[to]={level,element:elementForLevel(level)};state.board[from]=null;log(`Merge! Lv.${a.level} + Lv.${b.level} → Lv.${level}`)}
    else if(!b){state.board[to]=a;state.board[from]=null;log(`Magical Girl moved to line ${Math.floor(to/7)+1}.`)}
    else{state.board[to]=a;state.board[from]=b;log("Positions swapped.")}
    selectedIndex=null;dragIndex=null;renderBoard();
  }
  function selectUnit(i){if(!state.board[i])return;if(selectedIndex===null){selectedIndex=i;renderBoard();return}if(selectedIndex===i){selectedIndex=null;renderBoard();return}moveUnit(selectedIndex,i)}
  function highlightSelected(){if(selectedIndex!=null)$("grid").children[selectedIndex]?.classList.add("selected-slot")}
  function elementForLevel(lvl){const els=["🌱","🔥","💧","⚡","🌙","🌟"];return els[Math.min(els.length-1,Math.floor((lvl-1)/2))]}

  function spawnWave(){
    state.enemies=[];
    const count=state.data.enemyCount+(state.wave-1);
    for(let i=0;i<count;i++){const boss=state.data.boss&&i===count-1,hp=state.data.enemyHp*(1+(state.wave-1)*.28)*(boss?2.4:1);
      state.enemies.push({id:`e${Date.now()}-${i}-${Math.random()}`,hp,maxHp:hp,boss,emoji:boss?"👑":"👾",row:i%3,col:0+Math.floor(i/3)});
    }
    renderEnemies();updateHud();
  }

  function renderEnemies(){
    const lane=$("enemy-lane");lane.innerHTML="";
    state.enemies.forEach(e=>{
      const wrap=document.createElement("div");wrap.className=`enemy-wrap${e.boss?" boss":""}`;
      wrap.dataset.enemyId=e.id;wrap.style.gridRow=(e.row+1);wrap.style.gridColumn=Math.min(7,e.col+1);
      const pct=clamp(e.hp/e.maxHp*100,0,100);
      wrap.innerHTML=`<div class="enemy-hp"><div style="width:${pct}%"></div></div><div class="enemy-hp-text">${Math.max(0,Math.ceil(e.hp))}/${Math.ceil(e.maxHp)}</div><div class="enemy">${e.emoji}</div>`;
      lane.appendChild(wrap);
    });
  }

  function unitDamageForRow(row){let damage=0;for(let col=0;col<7;col++){const u=state.board[row*7+col];if(u)damage+=Math.pow(u.level,1.55)*4.5}return damage}

  function fireProjectile(fromIndex,enemyId,onImpact){
    const unit=$("grid").children[fromIndex]?.querySelector(".unit"),enemy=document.querySelector(`[data-enemy-id="${CSS.escape(enemyId)}"] .enemy`),field=$("battlefield");
    if(!unit||!enemy||!field){if(onImpact)onImpact();return}
    const a=unit.getBoundingClientRect(),b=enemy.getBoundingClientRect(),c=field.getBoundingClientRect();
    const p=document.createElement("div");p.className="projectile";$("projectiles").appendChild(p);
    const sx=a.left-c.left+a.width/2-5,sy=a.top-c.top+a.height/2-5,tx=b.left-c.left+b.width/2-5,ty=b.top-c.top+b.height/2-5;
    p.style.left=`${sx}px`;p.style.top=`${sy}px`;p.style.transform="translate(0,0)";
    requestAnimationFrame(()=>p.style.transform=`translate(${tx-sx}px,${ty-sy}px)`);
    setTimeout(()=>{p.classList.add("hit");showDamage(b.left-c.left+b.width/2,b.top-c.top,field, onImpact);setTimeout(()=>p.remove(),100)},330);
  }

  function showDamage(x,y,field,onDone){
    const d=document.createElement("div");d.className="damage-pop";d.textContent="HIT!";d.style.left=`${x-12}px`;d.style.top=`${y-5}px`;field.appendChild(d);
    setTimeout(()=>{d.remove();if(onDone)onDone()},120);
  }

  function attackPhase(){
    const attacks=[];
    for(let row=0;row<3;row++){
      const dmg=unitDamageForRow(row);if(!dmg)continue;
      const target=state.enemies.find(e=>e.row===row);if(!target)continue;
      const cols=[];for(let col=0;col<7;col++)if(state.board[row*7+col])cols.push(col);
      attacks.push({row,target,dmg,from:row*7+cols[cols.length-1]});
    }
    attacks.forEach(a=>{fireProjectile(a.from,a.target.id,()=>{});a.target.hp-=a.dmg});
    if(attacks.length)log("Your Magical Girls fire down their own lanes!");
  }

  function enemyPhase(){
    const total=state.enemies.reduce((sum,e)=>sum+(e.boss?8:4),0);
    state.baseHp=clamp(state.baseHp-total,0,state.maxBaseHp);
    if(total)log(`Enemies strike the Crystal Heart for ${total} damage.`);
  }

  function endTurn(){
    if(state.cleared)return;
    state.turn++;Object.keys(state.skillCooldowns).forEach(k=>{if(state.skillCooldowns[k]>0)state.skillCooldowns[k]--});
    attackPhase();
    // Give the player a short visual window before removing defeated enemies.
    setTimeout(()=>{
      if(state.cleared)return;
      cleanupEnemies();
      if(state.enemies.length===0){
        if(state.wave<state.data.waves){state.wave++;spawnWave();maybeSpawnPickup()}
        else victory();
      }else{enemyPhase();if(state.baseHp<=0)defeat()}
      renderEnemies();updateHud();updateSkillButtons();
    },360);
  }

  function cleanupEnemies(){state.enemies=state.enemies.filter(e=>e.hp>0);renderEnemies()}
  function useSkill(id){
    if(state.cleared)return;const skill=SKILLS.find(s=>s.id===id);if(!skill||state.stage<skill.unlockStage||state.skillCooldowns[id]>0)return;
    if(id==="arcane"){const dmg=25+save.accountLevel*4;state.enemies.forEach(e=>e.hp-=dmg);state.enemies.forEach(e=>fireProjectile(findAttacker(e.row),e.id));log(`Arcane Burst hits every enemy for ${dmg}.`)}
    else if(id==="guard"){const heal=Math.round(state.maxBaseHp*.25),before=state.baseHp;state.baseHp=clamp(state.baseHp+heal,0,state.maxBaseHp);log(`Crystal Guard restores ${state.baseHp-before} base HP.`)}
    else if(id==="meteor"){const target=state.enemies.reduce((a,b)=>!a||b.hp>a.hp?b:a,null);if(target){const dmg=80+save.accountLevel*8;target.hp-=dmg;fireProjectile(findAttacker(target.row),target.id);log(`Starfall hits for ${dmg} damage.`)}}
    state.skillCooldowns[id]=4;cleanupEnemies();
    if(!state.enemies.length){if(state.wave<state.data.waves){state.wave++;spawnWave();maybeSpawnPickup()}else victory()}
    updateHud();updateSkillButtons();
  }
  function findAttacker(row){for(let col=6;col>=0;col--)if(state.board[row*7+col])return row*7+col;return row*7}
  function updateSkillButtons(){
    const box=$("skill-buttons");if(!box)return;box.innerHTML="";
    unlockedSkills().forEach(s=>{const b=document.createElement("button");b.className=`skill-button ${state.selectedSkill===s.id?"active-skill":""}`;
      b.innerHTML=`<span>${s.icon}</span><span><b>${s.name}</b><small>${state.skillCooldowns[s.id]?`COOLDOWN ${state.skillCooldowns[s.id]}`:"READY"}</small></span>`;
      b.onclick=()=>{state.selectedSkill=s.id;updateSkillButtons();useSkill(s.id)};box.appendChild(b)});
  }

  function maybeSpawnPickup(){
    state.pickup=null;if(Math.random()>.38)return;const empty=[];state.board.forEach((u,i)=>{if(!u)empty.push(i)});if(!empty.length)return;
    const index=empty[Math.floor(Math.random()*empty.length)],isChest=Math.random()<.55;state.pickup={type:isChest?"chest":"unit",index};
    renderPickup();log(isChest?"A treasure chest appeared on the field!":"A new Magical Girl appeared on the field!");
  }
  function renderPickup(){
    document.querySelectorAll(".pickup").forEach(x=>x.remove());if(!state?.pickup)return;const slot=$("grid").children[state.pickup.index];if(!slot)return;
    const p=document.createElement("button");p.className="pickup";p.textContent=state.pickup.type==="chest"?"🎁":"✨";p.onclick=e=>{e.stopPropagation();collectPickup()};slot.appendChild(p);
  }
  function collectPickup(){
    if(!state?.pickup)return;const {type,index}=state.pickup;
    if(type==="chest"){const gems=5+Math.floor(Math.random()*6);save.gems+=gems;grantXp(12);log(`Chest opened! +${gems} gems.`)}
    else{state.board[index]={level:1,element:"🌱"};save.collectedUnits=(save.collectedUnits||0)+1;log("New Magical Girl added to the field!")}
    state.pickup=null;persist();renderBoard();updateHud()
  }
  function updateHud(){if(!state)return;$("wave-label").textContent=`WAVE ${state.wave}/${state.data.waves}`;$("turn-label").textContent=`TURN ${state.turn}`;$("base-hp-bar").style.width=`${clamp(state.baseHp/state.maxBaseHp*100,0,100)}%`;$("gems-label").textContent=save.gems;$("account-label").textContent=save.accountLevel}
  function victory(){state.cleared=true;const reward=40+state.stage*4;save.gems+=5+Math.floor(state.stage/10);grantXp(reward);save.stage=Math.min(MAX_STAGE,Math.max(save.stage,state.stage+1));persist();$("victory-title").textContent=state.stage===MAX_STAGE?"100 Stages Complete!":"Stage Clear!";$("victory-text").textContent=`You earned ${reward} account XP and gems.`;$("next-stage-button").textContent=state.stage===MAX_STAGE?"PLAY AGAIN":`STAGE ${state.stage+1}`;$("victory-modal").classList.remove("hidden")}
  function defeat(){state.cleared=true;$("victory-title").textContent="Base Defeated";$("victory-text").textContent="The Crystal Heart fell. Your account progress is safe.";$("next-stage-button").textContent="TRY AGAIN";$("victory-modal").classList.remove("hidden")}
  function log(text){$("combat-log").textContent=text}

  $("start-button").onclick=()=>newRun(save.stage);
  $("base-button").onclick=()=>{updateBase();showScreen("base-screen")};
  $("back-button").onclick=()=>{$("victory-modal").classList.add("hidden");showScreen("home-screen")};
  $("base-back-button").onclick=()=>showScreen("home-screen");
  $("end-turn-button").onclick=endTurn;
  $("upgrade-core-button").onclick=()=>{const cost=save.coreLevel*20;if(save.gems>=cost){save.gems-=cost;save.coreLevel++;persist()}else alert(`You need ${cost} gems.`)};
  $("next-stage-button").onclick=()=>{$("victory-modal").classList.add("hidden");newRun(state.stage===MAX_STAGE?1:state.stage+1)};

  updateHome();updateBase();$("offline-status").textContent=navigator.onLine?"Offline-ready • saved on this device":"Offline mode";
  window.addEventListener("online",()=>{$("offline-status").textContent="Connected • still playable offline"});
  window.addEventListener("offline",()=>{$("offline-status").textContent="Offline mode • game is still playable offline"});
})();
