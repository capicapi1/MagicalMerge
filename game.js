(() => {
  "use strict";

  const STORAGE_KEY = "magicalMergeSave_v2";
  const MAX_STAGE = 100;

  // Active skills are unlocked by progression, not randomly offered during a run.
  const SKILLS = [
    {id:"arcane", name:"Arcane Burst", icon:"⚡", description:"Deal heavy damage to every enemy.", unlockStage:1},
    {id:"guard", name:"Crystal Guard", icon:"🛡️", description:"Restore 25% of the Crystal Heart's maximum HP.", unlockStage:5},
    {id:"meteor", name:"Starfall", icon:"☄️", description:"Deal massive damage to the strongest enemy.", unlockStage:10}
  ];

  const defaultSave = {
    accountLevel:1, accountXp:0, gems:0, coreLevel:1, stage:1,
    collectedUnits:0
  };

  let save = loadSave();
  let state = null;
  let selectedIndex = null;
  let dragIndex = null;

  const $ = id => document.getElementById(id);
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));

  function loadSave() {
    try { return {...defaultSave, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")} }
    catch { return {...defaultSave}; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); updateHome(); updateBase(); }

  function stageData(n) {
    const world = Math.ceil(n / 10);
    const local = ((n - 1) % 10) + 1;
    const waves = 3 + Math.floor(n / 20);
    const enemyHp = Math.round(24 * Math.pow(1.075, n-1));
    const enemyCount = 2 + Math.min(5, Math.floor((n-1)/12));
    return {world, local, waves, enemyHp, enemyCount, boss:local===10};
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(id).classList.add("active");
  }

  function xpNeeded(level) { return 100 + (level-1)*35; }
  function updateHome() {
    $("home-account-level").textContent=save.accountLevel;
    const needed=xpNeeded(save.accountLevel);
    $("home-xp-bar").style.width=`${Math.min(100,(save.accountXp/needed)*100)}%`;
  }
  function updateBase() {
    $("base-account-level").textContent=save.accountLevel;
    const needed=xpNeeded(save.accountLevel);
    $("base-xp-bar").style.width=`${Math.min(100,(save.accountXp/needed)*100)}%`;
    $("base-xp-text").textContent=`${save.accountXp} / ${needed} XP`;
    $("core-level").textContent=save.coreLevel;
    $("core-hp-bonus").textContent=`${(save.coreLevel-1)*8}%`;
  }
  function grantXp(amount) {
    save.accountXp+=amount;
    while(save.accountXp>=xpNeeded(save.accountLevel)) {
      save.accountXp-=xpNeeded(save.accountLevel);
      save.accountLevel++;
    }
    persist();
  }

  function unlockedSkills(stageNum=save.stage) {
    return SKILLS.filter(s=>stageNum>=s.unlockStage);
  }

  function newRun(stageNum) {
    const d=stageData(stageNum);
    state={
      stage:stageNum,data:d,wave:1,turn:1,
      baseHp:100+(save.coreLevel-1)*8,maxBaseHp:100+(save.coreLevel-1)*8,
      enemies:[],board:Array(21).fill(null),
      skillCooldowns:{arcane:0,guard:0,meteor:0},
      selectedSkill:"arcane",cleared:false,pickup:null
    };
    selectedIndex=null;
    $("world-label").textContent=`WORLD ${d.world}`;
    $("stage-label").textContent=`STAGE ${stageNum}`;
    renderBoard();
    spawnWave();
    updateSkillButtons();
    log(`Stage ${stageNum} begins. Place your Magical Girls in the three battle lines.`);
    showScreen("game-screen");
  }

  function renderBoard() {
    const grid=$("grid");
    grid.innerHTML="";
    state.board.forEach((unit,i)=>{
      const slot=document.createElement("div");
      slot.className="slot";
      slot.dataset.index=i;
      slot.addEventListener("dragover",e=>e.preventDefault());
      slot.addEventListener("drop",e=>{e.preventDefault();moveUnit(dragIndex,i);});
      slot.addEventListener("click",()=>selectUnit(i));

      if(unit){
        const u=document.createElement("button");
        u.className=`unit level${Math.min(unit.level,4)}`;
        u.draggable=true;
        u.innerHTML=`<span>${unit.element}</span><small>Lv.${unit.level}</small>`;
        u.title="Drag to move. Drop onto the same level to merge.";
        u.addEventListener("dragstart",()=>{dragIndex=i;u.classList.add("dragging")});
        u.addEventListener("dragend",()=>{dragIndex=null;u.classList.remove("dragging")});
        u.addEventListener("click",e=>{e.stopPropagation();selectUnit(i)});
        u.addEventListener("pointerdown",()=>{dragIndex=i});
        slot.appendChild(u);
      }
      grid.appendChild(slot);
    });
    renderPickup();
  }

  function moveUnit(from,to) {
    if(from===null || from===undefined || from===to || !state.board[from]) return;
    const a=state.board[from], b=state.board[to];
    if(b && a.level===b.level) {
      const newLevel=a.level+1;
      state.board[to]={level:newLevel,element:elementForLevel(newLevel)};
      state.board[from]=null;
      log(`Merge! Lv.${a.level} + Lv.${b.level} → Lv.${newLevel}`);
    } else if(!b) {
      state.board[to]=a;
      state.board[from]=null;
      log(`Magical Girl moved to line ${Math.floor(to/7)+1}.`);
    } else {
      // Swap is useful on a tight 7x3 board.
      state.board[to]=a; state.board[from]=b;
      log("Positions swapped.");
    }
    selectedIndex=null; dragIndex=null; renderBoard();
  }

  function selectUnit(i) {
    if(!state.board[i]) return;
    if(selectedIndex===null){selectedIndex=i;renderBoard();highlightSelected();return;}
    if(selectedIndex===i){selectedIndex=null;renderBoard();return;}
    moveUnit(selectedIndex,i);
  }
  function highlightSelected(){
    if(selectedIndex!==null) $("grid").children[selectedIndex]?.classList.add("selected-slot");
  }
  function elementForLevel(lvl){
    const els=["🌱","🔥","💧","⚡","🌙","🌟"];
    return els[Math.min(els.length-1,Math.floor((lvl-1)/2))];
  }

  function enemyRow(i){ return i%3; }
  function renderEnemies() {
    const lane=$("enemy-lane");
    lane.innerHTML="";
    for(let row=0;row<3;row++){
      const rowEl=document.createElement("div");
      rowEl.className="enemy-row";
      rowEl.dataset.row=row;
      const rowEnemies=state.enemies.filter(e=>e.row===row);
      rowEnemies.forEach(e=>{
        const wrap=document.createElement("div");
        wrap.className=`enemy-wrap${e.boss?" boss": ""}`;
        wrap.dataset.enemyId=e.id;
        const hpPct=clamp(e.hp/e.maxHp*100,0,100);
        wrap.innerHTML=`<div class="enemy-hp"><div style="width:${hpPct}%"></div></div><div class="enemy">${e.emoji}</div>`;
        rowEl.appendChild(wrap);
      });
      lane.appendChild(rowEl);
    }
  }

  function spawnWave() {
    state.enemies=[];
    const count=state.data.enemyCount+(state.wave-1);
    for(let i=0;i<count;i++){
      const boss=state.data.boss && i===count-1;
      const hp=state.data.enemyHp*(1+(state.wave-1)*.28)*(boss?2.4:1);
      state.enemies.push({
        id:`${state.stage}-${state.wave}-${i}-${Date.now()}`,
        hp,maxHp:hp,boss,emoji:boss?"👑":"👾",row:i%3
      });
    }
    renderEnemies(); updateHud();
  }

  function unitDamageForRow(row){
    let damage=0;
    for(let col=0;col<7;col++){
      const u=state.board[row*7+col];
      if(u) damage+=Math.pow(u.level,1.55)*4.5;
    }
    return Math.max(0,damage);
  }

  function fireProjectile(row,enemyId){
    const p=document.createElement("div");
    p.className="projectile";
    p.dataset.row=row;
    $("projectiles").appendChild(p);
    requestAnimationFrame(()=>{
      const battlefield=$("battlefield");
      const enemy=document.querySelector(`[data-enemy-id="${enemyId}"]`);
      const targetRow=document.querySelector(`.enemy-row[data-row="${row}"]`);
      if(!targetRow||!enemy||!battlefield)return;
      const a=targetRow.getBoundingClientRect(), b=enemy.getBoundingClientRect(), c=battlefield.getBoundingClientRect();
      p.style.left=`${Math.max(8,a.left-c.left+8)}px`;
      p.style.top=`${a.top-c.top+a.height/2-4}px`;
      p.style.setProperty("--tx",`${b.left-c.left-a.left+c.left}px`);
      p.style.setProperty("--ty",`${b.top-c.top+b.height/2-(a.top-c.top+a.height/2)}px`);
      p.classList.add("flying");
    });
    setTimeout(()=>p.remove(),360);
  }

  function attackPhase(){
    const attacks=[];
    for(let row=0;row<3;row++){
      const damage=unitDamageForRow(row);
      if(!damage)continue;
      const target=state.enemies.find(e=>e.row===row);
      if(target){attacks.push({row,target,damage});}
    }
    attacks.forEach(a=>{
      a.target.hp-=a.damage;
      fireProjectile(a.row,a.target.id);
    });
    if(attacks.length) log("Your Magical Girls attack enemies in their own lines!");
  }

  function enemyPhase(){
    const rowDamage=[0,0,0];
    state.enemies.forEach(e=>rowDamage[e.row]+=e.boss?8:4);
    const total=rowDamage.reduce((a,b)=>a+b,0);
    state.baseHp=clamp(state.baseHp-total,0,state.maxBaseHp);
    if(total) log(`The enemies strike the Crystal Heart for ${total} damage.`);
  }

  function endTurn(){
    if(state.cleared)return;
    state.turn++;
    Object.keys(state.skillCooldowns).forEach(k=>{if(state.skillCooldowns[k]>0)state.skillCooldowns[k]--});
    attackPhase();
    cleanupEnemies();
    if(state.cleared)return;
    if(state.enemies.length===0){
      if(state.wave<state.data.waves){
        state.wave++;
        spawnWave();
        maybeSpawnPickup();
      } else {victory();return;}
    } else {
      enemyPhase();
      if(state.baseHp<=0){defeat();return;}
    }
    renderEnemies();updateHud();updateSkillButtons();
  }

  function cleanupEnemies(){
    state.enemies=state.enemies.filter(e=>e.hp>0);
    renderEnemies();
  }

  function useSkill(id){
    if(state.cleared)return;
    const skill=SKILLS.find(s=>s.id===id);
    if(!skill || state.stage<skill.unlockStage || state.skillCooldowns[id]>0)return;
    if(id==="arcane"){
      const dmg=25+save.accountLevel*4;
      state.enemies.forEach(e=>e.hp-=dmg);
      state.enemies.forEach(e=>fireProjectile(e.row,e.id));
      log(`Arcane Burst hits every enemy for ${dmg}.`);
    } else if(id==="guard"){
      const heal=Math.round(state.maxBaseHp*.25);
      const before=state.baseHp;
      state.baseHp=clamp(state.baseHp+heal,0,state.maxBaseHp);
      log(`Crystal Guard restores ${state.baseHp-before} base HP.`);
    } else if(id==="meteor"){
      const target=state.enemies.reduce((a,b)=>!a||b.hp>a.hp?b:a,null);
      if(target){
        const dmg=80+save.accountLevel*8;
        target.hp-=dmg;
        fireProjectile(target.row,target.id);
        log(`Starfall crashes on ${target.boss?"the boss":"the strongest enemy"} for ${dmg} damage.`);
      }
    }
    state.skillCooldowns[id]=4;
    cleanupEnemies();
    if(state.enemies.length===0){
      if(state.wave<state.data.waves){state.wave++;spawnWave();maybeSpawnPickup();}
      else victory();
    }
    updateHud();updateSkillButtons();
  }

  function updateSkillButtons(){
    const box=$("skill-buttons");
    if(!box)return;
    box.innerHTML="";
    unlockedSkills(state?.stage||save.stage).forEach(s=>{
      const b=document.createElement("button");
      b.className=`skill-button ${state?.selectedSkill===s.id?"active-skill":""}`;
      b.innerHTML=`<span>${s.icon}</span><span><b>${s.name}</b><small>${state?.skillCooldowns[s.id]?`COOLDOWN ${state.skillCooldowns[s.id]}`:"READY"}</small></span>`;
      b.onclick=()=>{state.selectedSkill=s.id;updateSkillButtons();useSkill(s.id)};
      box.appendChild(b);
    });
  }

  // Replaces the old "choose a skill" popup. Pickups appear in the battle area instead.
  function maybeSpawnPickup(){
    state.pickup=null;
    const chance=.38;
    if(Math.random()>chance)return;
    const empty=[];
    state.board.forEach((u,i)=>{if(!u)empty.push(i)});
    if(!empty.length)return;
    const index=empty[Math.floor(Math.random()*empty.length)];
    const isChest=Math.random()<.55;
    state.pickup={type:isChest?"chest":"unit",index,level:isChest?null:1};
    renderPickup();
    log(isChest?"A treasure chest appeared on the field!":"A new Magical Girl has appeared on the field!");
  }

  function renderPickup(){
    document.querySelectorAll(".pickup").forEach(x=>x.remove());
    if(!state?.pickup)return;
    const slot=$("grid").children[state.pickup.index];
    if(!slot)return;
    const p=document.createElement("button");
    p.className="pickup";
    p.textContent=state.pickup.type==="chest"?"🎁":"✨";
    p.title=state.pickup.type==="chest"?"Collect chest":"Collect new unit";
    p.onclick=e=>{e.stopPropagation();collectPickup()};
    slot.appendChild(p);
  }

  function collectPickup(){
    if(!state?.pickup)return;
    const {type,index}=state.pickup;
    if(type==="chest"){
      const gems=5+Math.floor(Math.random()*6);
      save.gems+=gems; grantXp(12); log(`Chest opened! +${gems} gems.`);
    } else {
      state.board[index]={level:1,element:"🌱"};
      save.collectedUnits=(save.collectedUnits||0)+1;
      log("New Magical Girl added to the field!");
    }
    state.pickup=null;persist();renderBoard();updateHud();
  }

  function updateHud(){
    if(!state)return;
    $("wave-label").textContent=`WAVE ${state.wave}/${state.data.waves}`;
    $("turn-label").textContent=`TURN ${state.turn}`;
    $("base-hp-bar").style.width=`${clamp(state.baseHp/state.maxBaseHp*100,0,100)}%`;
    $("gems-label").textContent=save.gems;
  }

  function victory(){
    state.cleared=true;
    const reward=40+state.stage*4;
    save.gems+=5+Math.floor(state.stage/10);
    grantXp(reward);
    save.stage=Math.min(MAX_STAGE,Math.max(save.stage,state.stage+1));
    persist();
    $("victory-title").textContent=state.stage===MAX_STAGE?"100 Stages Complete!":"Stage Clear!";
    $("victory-text").textContent=`You earned ${reward} account XP and gems.`;
    $("next-stage-button").textContent=state.stage===MAX_STAGE?"PLAY AGAIN":`STAGE ${state.stage+1}`;
    $("victory-modal").classList.remove("hidden");
  }
  function defeat(){
    state.cleared=true;
    $("victory-title").textContent="Base Defeated";
    $("victory-text").textContent="The Crystal Heart fell. Your account progress is safe.";
    $("next-stage-button").textContent="TRY AGAIN";
    $("victory-modal").classList.remove("hidden");
  }
  function log(text){$("combat-log").textContent=text;}

  $("start-button").onclick=()=>newRun(save.stage);
  $("base-button").onclick=()=>{updateBase();showScreen("base-screen")};
  $("back-button").onclick=()=>{$("victory-modal").classList.add("hidden");showScreen("home-screen")};
  $("base-back-button").onclick=()=>showScreen("home-screen");
  $("end-turn-button").onclick=endTurn;
  $("upgrade-core-button").onclick=()=>{
    const cost=save.coreLevel*20;
    if(save.gems>=cost){save.gems-=cost;save.coreLevel++;persist();}
    else alert(`You need ${cost} gems.`);
  };
  $("next-stage-button").onclick=()=>{
    $("victory-modal").classList.add("hidden");
    newRun(state.stage===MAX_STAGE?1:state.stage+1);
  };

  // First-stage starting formation: three lines, one unit per line.
  const originalNewRun=newRun;
  newRun=function(stageNum){
    originalNewRun(stageNum);
    state.board[14]={level:1,element:"🌱"};
    state.board[15]={level:1,element:"🌱"};
    state.board[16]={level:1,element:"🌱"};
    renderBoard();updateHud();updateSkillButtons();
  };

  updateHome();updateBase();
  $("offline-status").textContent=navigator.onLine?"Offline-ready • saved on this device":"Offline mode";
  window.addEventListener("online",()=>$("offline-status").textContent="Connected • still playable offline");
  window.addEventListener("offline",()=>$("offline-status").textContent="Offline mode • game is still playable");
})();
