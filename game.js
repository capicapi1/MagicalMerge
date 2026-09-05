(() => {
  "use strict";

  const STORAGE_KEY = "magicalMergeSave_v1";
  const MAX_STAGE = 100;

  const SKILLS = [
    {id:"arcane", name:"Arcane Burst", icon:"⚡", description:"Deal heavy damage to every enemy.", type:"active"},
    {id:"guard", name:"Crystal Guard", icon:"🛡️", description:"Restore 18% of the base HP.", type:"active"},
    {id:"meteor", name:"Starfall", icon:"☄️", description:"Deal massive damage to the strongest enemy.", type:"active"},
    {id:"lucky", name:"Lucky Merge", icon:"🍀", description:"Increases the chance of a bonus merge.", type:"passive"},
    {id:"swift", name:"Swift Hands", icon:"✨", description:"Gain +1 starting unit each stage.", type:"passive"},
    {id:"power", name:"Magic Power", icon:"💜", description:"All merged units deal +15% damage.", type:"passive"}
  ];

  const defaultSave = {
    accountLevel: 1, accountXp: 0, gems: 0, coreLevel: 1, stage: 1,
    unlockedSkills: ["arcane","guard","meteor","lucky","swift","power"]
  };

  let save = loadSave();
  let state = null;

  const $ = id => document.getElementById(id);
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));

  function loadSave() {
    try { return {...defaultSave, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")}; }
    catch { return {...defaultSave}; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); updateHome(); updateBase(); }

  function stageData(n) {
    const world = Math.ceil(n / 10);
    const local = ((n - 1) % 10) + 1;
    const waves = 3 + Math.floor(n / 20);
    const enemyHp = Math.round(24 * Math.pow(1.075, n-1));
    const enemyCount = 2 + Math.min(5, Math.floor((n-1)/12));
    return {world, local, waves, enemyHp, enemyCount, boss: local === 10};
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  function updateHome() {
    $("home-account-level").textContent = save.accountLevel;
    $("account-label").textContent = save.accountLevel;
    const needed = xpNeeded(save.accountLevel);
    $("home-xp-bar").style.width = `${(save.accountXp/needed)*100}%`;
  }
  function updateBase() {
    $("base-account-level").textContent = save.accountLevel;
    const needed = xpNeeded(save.accountLevel);
    $("base-xp-bar").style.width = `${(save.accountXp/needed)*100}%`;
    $("base-xp-text").textContent = `${save.accountXp} / ${needed} XP`;
    $("core-level").textContent = save.coreLevel;
    $("core-hp-bonus").textContent = `${(save.coreLevel-1)*8}%`;
  }
  function xpNeeded(level) { return 100 + (level-1)*35; }
  function grantXp(amount) {
    save.accountXp += amount;
    while (save.accountXp >= xpNeeded(save.accountLevel)) {
      save.accountXp -= xpNeeded(save.accountLevel);
      save.accountLevel++;
      log(`Account Level ${save.accountLevel}! Your base grows stronger.`);
    }
    persist();
  }

  function newRun(stageNum) {
    const d = stageData(stageNum);
    state = {
      stage: stageNum, data: d, wave: 1, turn: 1,
      baseHp: 100 + (save.coreLevel-1)*8,
      maxBaseHp: 100 + (save.coreLevel-1)*8,
      enemies: [], board: Array(21).fill(null),
      skillCooldown: 0, selectedSkill: "arcane",
      runSkills: [], cleared: false
    };
    $("world-label").textContent = `WORLD ${d.world}`;
    $("stage-label").textContent = `STAGE ${stageNum}`;
    renderBoard();
    spawnWave();
    log(`Stage ${stageNum} begins. Merge units to grow stronger.`);
    showScreen("game-screen");
  }

  function renderBoard() {
    const grid = $("grid");
    grid.innerHTML = "";
    state.board.forEach((unit, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = i;
      if (unit) {
        const u = document.createElement("button");
        u.className = `unit level${Math.min(unit.level,4)}`;
        u.innerHTML = `${unit.element}<small>Lv.${unit.level}</small>`;
        u.title = "Tap another unit of the same level to merge";
        u.addEventListener("click", () => selectUnit(i));
        slot.appendChild(u);
      }
      grid.appendChild(slot);
    });
  }

  let selectedIndex = null;
  function selectUnit(i) {
    if (!state.board[i]) return;
    if (selectedIndex === null) {
      selectedIndex = i;
      $("grid").children[i].style.outline = "3px solid #fff";
      $("grid").children[i].style.boxShadow = "0 0 0 2px #9b65b5";
      return;
    }
    if (selectedIndex === i) { selectedIndex = null; renderBoard(); return; }
    const a = state.board[selectedIndex], b = state.board[i];
    if (a && b && a.level === b.level) {
      const newLevel = a.level + 1;
      const lucky = state.runSkills.includes("lucky") && Math.random() < .20;
      state.board[i] = {level:newLevel + (lucky ? 1 : 0), element: elementForLevel(newLevel)};
      state.board[selectedIndex] = null;
      log(`Merge! Lv.${a.level} + Lv.${b.level} → Lv.${state.board[i].level}`);
      selectedIndex = null;
      renderBoard();
    } else {
      selectedIndex = i;
      renderBoard();
      $("grid").children[i].style.outline = "3px solid #fff";
    }
  }
  function elementForLevel(lvl) {
    const els = ["🌱","🔥","💧","⚡","🌙","🌟"];
    return els[Math.min(els.length-1, Math.floor((lvl-1)/2))];
  }

  function spawnWave() {
    state.enemies = [];
    const count = state.data.enemyCount + (state.wave-1);
    for (let i=0;i<count;i++) {
      state.enemies.push({
        hp: state.data.enemyHp * (1 + (state.wave-1)*.28),
        maxHp: state.data.enemyHp * (1 + (state.wave-1)*.28),
        boss: state.data.boss && i===count-1,
        emoji: state.data.boss && i===count-1 ? "👑" : "👾"
      });
    }
    renderEnemies();
    updateHud();
  }

  function renderEnemies() {
    const lane = $("enemy-lane");
    lane.innerHTML = "";
    state.enemies.forEach((e,i) => {
      const el = document.createElement("div");
      el.className = `enemy${e.boss ? " boss" : ""}`;
      el.textContent = e.emoji;
      el.style.opacity = e.hp <= 0 ? "0" : "1";
      lane.appendChild(el);
    });
  }

  function unitDamage() {
    let damage = 0;
    state.board.forEach(u => { if (u) damage += Math.pow(u.level,1.55)*4.5; });
    if (state.runSkills.includes("power")) damage *= 1.15;
    return Math.max(2, damage);
  }

  function endTurn() {
    if (state.cleared || $("skill-choices").classList.contains("hidden") === false) return;
    state.turn++;
    if (state.skillCooldown > 0) state.skillCooldown--;
    const dmg = unitDamage();
    if (state.enemies.length) {
      const target = state.enemies[0];
      target.hp -= dmg;
      fireProjectile();
      if (target.hp <= 0) state.enemies.shift();
      log(`Your Magical Girls deal ${Math.round(dmg)} damage.`);
    }
    if (state.enemies.length === 0) {
      if (state.wave < state.data.waves) {
        state.wave++;
        if (state.wave === 2 || state.wave === state.data.waves) maybeSkillChoice();
        spawnWave();
      } else {
        victory();
        return;
      }
    } else {
      const enemyDamage = state.enemies.reduce((sum,e)=>sum+(e.boss?9:4),0);
      state.baseHp = clamp(state.baseHp-enemyDamage,0,state.maxBaseHp);
      if (state.baseHp <= 0) { defeat(); return; }
    }
    renderEnemies(); updateHud();
  }

  function fireProjectile() {
    const p = document.createElement("div");
    p.className = "projectile";
    p.style.left = "50%"; p.style.bottom = "30%";
    $("projectiles").appendChild(p);
    setTimeout(()=>p.remove(),300);
  }

  function useSkill() {
    if (state.skillCooldown > 0) return;
    const skill = SKILLS.find(s=>s.id===state.selectedSkill);
    if (!skill || skill.type !== "active") return;
    if (skill.id === "arcane") {
      const dmg = 25 + save.accountLevel*4;
      state.enemies.forEach(e=>e.hp-=dmg);
      log(`Arcane Burst hits every enemy for ${dmg}.`);
    } else if (skill.id === "guard") {
      const heal = Math.round(state.maxBaseHp*.18);
      state.baseHp = clamp(state.baseHp+heal,0,state.maxBaseHp);
      log(`Crystal Guard restores ${heal} base HP.`);
    } else if (skill.id === "meteor") {
      if (state.enemies.length) {
        const dmg = 80 + save.accountLevel*8;
        state.enemies[0].hp -= dmg;
        log(`Starfall crashes for ${dmg} damage.`);
      }
    }
    state.skillCooldown = 4;
    cleanupEnemies();
    renderEnemies(); updateHud();
  }

  function cleanupEnemies() {
    state.enemies = state.enemies.filter(e=>e.hp>0);
    if (state.enemies.length===0) {
      if (state.wave < state.data.waves) { state.wave++; spawnWave(); }
      else victory();
    }
  }

  function maybeSkillChoice() {
    if (state.runSkills.length >= 3) return;
    $("skill-options").innerHTML = "";
    const candidates = SKILLS.filter(s=>!state.runSkills.includes(s.id));
    candidates.slice(0,3).forEach(skill=>{
      const b = document.createElement("button");
      b.className = "skill-option";
      b.innerHTML = `<strong>${skill.icon} ${skill.name}</strong><span>${skill.description}</span>`;
      b.onclick = () => {
        state.runSkills.push(skill.id);
        if (skill.type==="active") state.selectedSkill = skill.id;
        $("skill-choices").classList.add("hidden");
        log(`${skill.name} added to this run.`);
      };
      $("skill-options").appendChild(b);
    });
    $("skill-choices").classList.remove("hidden");
  }

  function updateHud() {
    $("wave-label").textContent = `WAVE ${state.wave}/${state.data.waves}`;
    $("turn-label").textContent = `TURN ${state.turn}`;
    $("base-hp-bar").style.width = `${(state.baseHp/state.maxBaseHp)*100}%`;
    $("skill-cooldown").textContent = state.skillCooldown ? `COOLDOWN ${state.skillCooldown}` : "READY";
    const s = SKILLS.find(x=>x.id===state.selectedSkill);
    $("skill-name").textContent = s ? s.name : "No Skill";
    $("skill-icon").textContent = s ? s.icon : "✦";
  }

  function victory() {
    state.cleared = true;
    const reward = 40 + state.stage*4;
    save.gems += 5 + Math.floor(state.stage/10);
    grantXp(reward);
    save.stage = Math.min(MAX_STAGE, Math.max(save.stage, state.stage+1));
    persist();
    $("victory-title").textContent = state.stage === MAX_STAGE ? "100 Stages Complete!" : "Stage Clear!";
    $("victory-text").textContent = `You earned ${reward} account XP and gems.`;
    $("next-stage-button").textContent = state.stage === MAX_STAGE ? "PLAY AGAIN" : `STAGE ${state.stage+1}`;
    $("victory-modal").classList.remove("hidden");
  }

  function defeat() {
    state.cleared = true;
    $("victory-title").textContent = "Base Defeated";
    $("victory-text").textContent = "The Crystal Heart fell. Your account progress is safe.";
    $("next-stage-button").textContent = "TRY AGAIN";
    $("victory-modal").classList.remove("hidden");
  }

  function log(text) {
    $("combat-log").textContent = text;
  }

  $("start-button").onclick = () => newRun(save.stage);
  $("base-button").onclick = () => { updateBase(); showScreen("base-screen"); };
  $("back-button").onclick = () => { $("victory-modal").classList.add("hidden"); showScreen("home-screen"); };
  $("base-back-button").onclick = () => showScreen("home-screen");
  $("end-turn-button").onclick = endTurn;
  $("skill-button").onclick = useSkill;
  $("upgrade-core-button").onclick = () => {
    const cost = save.coreLevel * 20;
    if (save.gems >= cost) {
      save.gems -= cost; save.coreLevel++; persist(); log(`Core upgraded to level ${save.coreLevel}.`);
    } else {
      alert(`You need ${cost} gems.`);
    }
  };
  $("next-stage-button").onclick = () => {
    $("victory-modal").classList.add("hidden");
    newRun(state.stage === MAX_STAGE ? 1 : state.stage+1);
  };

  // Seed a few units so the first stage is immediately playable.
  const originalNewRun = newRun;
  newRun = function(stageNum) {
    originalNewRun(stageNum);
    state.board[17] = {level:1,element:"🌱"};
    state.board[18] = {level:1,element:"🌱"};
    state.board[19] = {level:1,element:"🌱"};
    renderBoard();
    updateHud();
  };

  updateHome(); updateBase();
  $("offline-status").textContent = navigator.onLine ? "Offline-ready • saved on this device" : "Offline mode";
  window.addEventListener("online",()=>{$("offline-status").textContent="Connected • still playable offline";});
  window.addEventListener("offline",()=>{$("offline-status").textContent="Offline mode • game is still playable";});
})();
