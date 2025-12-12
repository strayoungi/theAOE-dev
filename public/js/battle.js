// ===============================
// Battle RPG Logic (Refactored)
// - Shield no longer resets every turn
// - Buffs stack correctly
// - Centralized damage + shield absorption
// - Safer skill MP handling + popup listeners not duplicated
// ===============================

class Character {
  constructor(
    name,
    hp,
    mp,
    atk,
    def,
    attackMultiplier,
    critRate = 0,
    critDamage = 1.5,
    skills = []
  ) {
    this.name = name;

    this.maxHp = hp;
    this.hp = hp;

    this.maxMp = mp;
    this.mp = mp;

    this.baseAtk = atk;
    this.atk = atk;

    this.baseDef = def;
    this.def = def;

    this.attackMultiplier = attackMultiplier;

    this.baseCritRate = critRate;
    this.critRate = critRate;

    this.baseCritDamage = critDamage;
    this.critDamage = critDamage;

    // Shield: persistent resource, reduced by damage
    this.shield = 0;     // current shield
    this.maxShield = 0;  // cap computed from active shield buffs

    this.skills = skills;
    this.buffs = [];

    // Ensure derived stats are consistent at start
    this.recalcStats();
  }

  // --- Centralized damage application (handles shield) ---
  applyDamage(amount) {
    amount = Math.max(0, amount);

    let absorbed = 0;
    if (this.shield > 0) {
      absorbed = Math.min(amount, this.shield);
      this.shield -= absorbed;
      amount -= absorbed;
    }

    this.hp = Math.max(0, this.hp - amount);

    // "damage" returned here is TOTAL attempted (hp + absorbed) like your old code
    return { damage: amount + absorbed, absorbed };
  }

  // --- Damage roll (crit) ---
  calculateDamage(baseDamage) {
    let isCrit = Math.random() < this.critRate;
    let damage = baseDamage;

    if (isCrit) damage *= this.critDamage;

    return { damage: Math.max(0, Math.floor(damage)), isCrit };
  }

  // --- Recalculate stats from stacked buffs (shield cap too) ---
  recalcStats() {
    // Stack percentages additively
    let atkBonus = 0;
    let defBonus = 0;
    let critRateBonus = 0;
    let critDmgBonus = 0;
    let shieldBonus = 0; // total cap from buffs

    this.buffs.forEach(buff => {
      if (buff.type === "atk_percent") atkBonus += buff.value;
      else if (buff.type === "def_percent") defBonus += buff.value;
      else if (buff.type === "crit_rate_percent") critRateBonus += buff.value;
      else if (buff.type === "crit_damage_percent") critDmgBonus += buff.value;
      else if (buff.type === "shield") shieldBonus += buff.value;
    });

    this.atk = Math.floor(this.baseAtk * (1 + atkBonus / 100));
    this.def = Math.floor(this.baseDef * (1 + defBonus / 100));
    this.critRate = Math.min(1, this.baseCritRate + critRateBonus / 100);
    this.critDamage = this.baseCritDamage * (1 + critDmgBonus / 100);

    // Shield cap comes from buffs, but current shield is NOT reset every turn
    this.maxShield = Math.max(0, Math.floor(shieldBonus));
    // clamp current shield to cap (important when buff expires)
    this.shield = Math.min(this.shield, this.maxShield);
  }

  // --- Normal attack ---
  attack(target) {
    let baseDamage = (this.atk * this.attackMultiplier) - target.def;
    baseDamage = Math.max(1, Math.floor(baseDamage));

    let { damage, isCrit } = this.calculateDamage(baseDamage);
    let result = target.applyDamage(damage);

    return { ...result, isCrit };
  }

  // --- Skills ---
  useSkill(skillIndex, target) {
    const skill = this.skills[skillIndex];
    if (!skill) return null;

    if (this.mp < skill.mpCost) return null;
    this.mp -= skill.mpCost;

    if (skill.effect === "damage") {
      let baseDamage = (skill.damage * (skill.multiplier || 1)) - target.def;
      baseDamage = Math.max(1, Math.floor(baseDamage));

      let { damage, isCrit } = this.calculateDamage(baseDamage);
      let result = target.applyDamage(damage);
      return { ...result, isCrit };

    } else if (skill.effect === "heal") {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + skill.heal);
      const healed = target.hp - before;
      return { heal: healed };

    } else if (skill.effect === "buff") {
      this.buffs.push({
        type: skill.buffType,
        value: skill.buffValue,
        turns: skill.buffTurns
      });

      // If it’s a shield buff, grant shield immediately (as a resource)
      if (skill.buffType === "shield") {
        this.shield += skill.buffValue;
      }

      this.recalcStats();
      // if shield exceeded cap, clamp after recalculation
      this.shield = Math.min(this.shield, this.maxShield);

      return { buff: skill.buffValue };
    }

    return null;
  }

  // --- Turn end: reduce buff durations then recalc ---
  endTurn() {
    this.buffs = this.buffs.filter(buff => {
      buff.turns--;
      return buff.turns > 0;
    });
    this.recalcStats();
  }
}

class Battle {
  constructor(player, enemies) {
    this.player = player;
    this.enemies = enemies;

    this.isPlayerTurn = true;
    this.battleLog = [];

    this.selectedSkill = null;
    this.selectedTarget = 0; // Default target enemy 0
  }

  startBattle() {
    this.updateUI();
    this.logMessage("Battle started!");
  }

  playerAction(action) {
    const player = this.player;
    let message = `${player.name} `;

    switch (action) {
      case "attack": {
        const targetEnemy = this.enemies[this.selectedTarget];
        if (targetEnemy && targetEnemy.hp > 0) {
          const result = player.attack(targetEnemy);
          message += `attacks ${targetEnemy.name} for ${result.damage} damage!`;
          if (result.absorbed > 0) message += ` (${result.absorbed} absorbed by shield!)`;
          if (result.isCrit) message += " (Critical!)";

          // Gain 5 MP on normal attack
          player.mp = Math.min(player.maxMp, player.mp + 5);
        } else {
          message += "tries to attack but target is defeated!";
        }
        break;
      }

      case "skill": {
        if (this.selectedSkill === null) return;

        const skill = player.skills[this.selectedSkill];
        if (!skill) return;

        // Quick MP check BEFORE doing anything (fixes misleading messages)
        if (player.mp < skill.mpCost) {
          this.logMessage(`${player.name} doesn't have enough MP!`);
          this.updateUI();
          return;
        }

        const target =
          (skill.effect === "heal" || skill.effect === "buff")
            ? player
            : this.enemies[this.selectedTarget];

        if (!target || (skill.effect === "damage" && target.hp <= 0)) {
          this.logMessage(`${player.name} invalid target!`);
          this.updateUI();
          return;
        }

        const result = player.useSkill(this.selectedSkill, target);
        if (!result) {
          this.logMessage(`${player.name} doesn't have enough MP!`);
          this.updateUI();
          return;
        }

        if (skill.effect === "damage") {
          message += `uses ${skill.name} on ${target.name} for ${result.damage} damage!`;
          if (result.absorbed > 0) message += ` (${result.absorbed} absorbed by shield!)`;
          if (result.isCrit) message += " (Critical!)";
        } else if (skill.effect === "heal") {
          message += `uses ${skill.name} and heals for ${result.heal} HP!`;
        } else if (skill.effect === "buff") {
          let buffDesc = "";
          if (skill.buffType === "atk_percent") buffDesc = "ATK";
          else if (skill.buffType === "def_percent") buffDesc = "DEF";
          else if (skill.buffType === "crit_rate_percent") buffDesc = "Crit Rate";
          else if (skill.buffType === "crit_damage_percent") buffDesc = "Crit Damage";
          else if (skill.buffType === "shield") buffDesc = "Shield";

          message += `uses ${skill.name} and gains ${buffDesc} of ${result.buff}!`;
        }

        break;
      }

      default:
        return;
    }

    this.logMessage(message);
    this.checkBattleEnd();

    if (!this.isBattleOver()) {
      this.isPlayerTurn = false;
      this.updateUI();
      setTimeout(() => this.enemyTurn(), 1000);
    }
  }

  enemyTurn() {
    this.enemies.forEach(enemy => {
      if (enemy.hp > 0) {
        const result = enemy.attack(this.player);
        let msg = `${enemy.name} attacks ${this.player.name} for ${result.damage} damage!`;
        if (result.absorbed > 0) msg += ` (${result.absorbed} absorbed by shield!)`;
        this.logMessage(msg);
      }
    });

    this.player.endTurn();
    this.enemies.forEach(e => e.endTurn());

    this.checkBattleEnd();
    if (!this.isBattleOver()) {
      this.isPlayerTurn = true;
      this.updateUI();
    }
  }

  checkBattleEnd() {
    const enemiesAlive = this.enemies.some(e => e.hp > 0);

    if (this.player.hp <= 0) {
      this.logMessage("You lose!");
      this.endBattle();
      this.showLosePopup();
    } else if (!enemiesAlive) {
      this.logMessage("You win!");
      this.endBattle();
      this.showVictoryPopup();
    }
  }

  isBattleOver() {
    return this.player.hp <= 0 || this.enemies.every(e => e.hp <= 0);
  }

  endBattle() {
    document.querySelectorAll(".btn").forEach(btn => (btn.disabled = true));
    document.querySelectorAll(".skill-card").forEach(card => (card.style.pointerEvents = "none"));
  }

  showVictoryPopup() {
    const expGained = this.enemies.length * 10;
    const coinsGained = this.enemies.length * 5;

    document.getElementById("exp-gained").textContent = expGained;
    document.getElementById("coins-gained").textContent = coinsGained;

    document.getElementById("victory-popup").style.display = "flex";

    // Use onclick to prevent duplicate listeners stacking
    document.getElementById("back-to-zone").onclick = () => {
      window.location.href = "zona1.html";
    };

    document.getElementById("continue-battle").onclick = () => {
      window.location.href = "zona1.html";
    };

    document.getElementById("view-log").onclick = () => {
      this.showBattleLog();
    };
  }

  showLosePopup() {
    document.getElementById("lose-popup").style.display = "flex";

    document.getElementById("back-to-zone-lose").onclick = () => {
      window.location.href = "zona1.html";
    };

    document.getElementById("try-again-battle").onclick = () => {
      window.location.href = "battle.html";
    };

    document.getElementById("view-battle-log").onclick = () => {
      this.showBattleLog();
    };
  }

  showBattleLog() {
    const logContent = document.getElementById("log-content");
    logContent.innerHTML = this.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join("");
    document.getElementById("log-modal").style.display = "flex";

    document.getElementById("close-log").onclick = () => {
      document.getElementById("log-modal").style.display = "none";
    };
  }

  logMessage(message) {
    this.battleLog.push(message);
    this.updateBattleLog();
  }

  updateUI() {
    // Player stats
    const playerCard = document.querySelector(".player-section .status-card");
    playerCard.querySelector(".name").textContent = this.player.name;

    playerCard.querySelector(".stat:nth-child(3)").textContent = `HP: ${this.player.hp} / ${this.player.maxHp}`;
    playerCard.querySelector(".stat:nth-child(4)").textContent = `MP: ${this.player.mp} / ${this.player.maxMp}`;
    playerCard.querySelector(".stat:nth-child(5)").textContent = `ATK: ${this.player.atk}`;
    playerCard.querySelector(".stat:nth-child(6)").textContent = `DEF: ${this.player.def}`;

    // Shield display (show current/cap if cap exists)
    const shieldStat = playerCard.querySelector(".stat:nth-child(7)");
    if (this.player.maxShield > 0) {
      shieldStat.textContent = `Shield: ${this.player.shield} / ${this.player.maxShield}`;
    } else {
      shieldStat.textContent = "";
    }

    const playerHealthBar = playerCard.querySelector(".health-bar-fill");
    playerHealthBar.style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;

    // Enemy stats
    const enemyCards = document.querySelectorAll(".enemy-section .status-card");
    this.enemies.forEach((enemy, index) => {
      if (enemyCards[index]) {
        enemyCards[index].querySelector(".name").textContent = enemy.name;
        enemyCards[index].querySelector(".stat:nth-child(2)").textContent = `HP: ${enemy.hp} / ${enemy.maxHp}`;
        enemyCards[index].querySelector(".stat:nth-child(3)").textContent = `ATK: ${enemy.atk}`;
        enemyCards[index].querySelector(".stat:nth-child(4)").textContent = `DEF: ${enemy.def}`;

        const enemyHealthBar = enemyCards[index].querySelector(".health-bar-fill");
        enemyHealthBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
      }
    });

    // Turn indicator
    const turnIndicator = document.querySelector(".turn-indicator");
    turnIndicator.textContent = this.isPlayerTurn ? `${this.player.name}'s turn` : `Enemies' turn`;

    // Selected target visual + disable targeting on enemy turn
    document.querySelectorAll(".enemy-section").forEach((section, index) => {
      section.classList.toggle("selected", index === this.selectedTarget);
      section.style.pointerEvents = this.isPlayerTurn ? "auto" : "none";
      section.style.opacity = this.isPlayerTurn ? "1" : "0.5";
    });
  }

  updateBattleLog() {
    const logElement = document.querySelector(".battle-log");
    logElement.innerHTML = this.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join("");
    logElement.scrollTop = logElement.scrollHeight;
  }
}

// ===============================
// Initialize battle
// ===============================
const player = new Character("Hero A", 200, 50, 25, 15, 0.8, 0.2, 1.5, [
  { name: "Fireball", effect: "damage", damage: 40, multiplier: 1.2, mpCost: 10 },
  { name: "Shadow Strike", effect: "heal", heal: 30, mpCost: 12 },
  { name: "Flame Burst", effect: "buff", buffType: "def_percent", buffValue: 10, buffTurns: 2, mpCost: 10 },
  { name: "Critical Boost", effect: "buff", buffType: "crit_rate_percent", buffValue: 20, buffTurns: 2, mpCost: 15 },
  { name: "Protective Barrier", effect: "buff", buffType: "shield", buffValue: 30, buffTurns: 2, mpCost: 12 }
]);

const enemies = [
  new Character("Goblin", 100, 0, 10, 5, 1.0),
  new Character("Orc", 120, 0, 15, 24, 1.0)
];

const battle = new Battle(player, enemies);

// ===============================
// Event listeners
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  battle.startBattle();

  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!battle.isPlayerTurn) return;

      if (btn.textContent === "Attack") {
        battle.playerAction("attack");
      }
    });
  });

  document.querySelectorAll(".skill-card").forEach((skillCard, index) => {
    skillCard.addEventListener("click", () => {
      if (!battle.isPlayerTurn) return;

      document.querySelectorAll(".skill-card").forEach(s => s.classList.remove("selected"));
      skillCard.classList.add("selected");
      battle.selectedSkill = index;

      // Auto use skill after selection
      setTimeout(() => battle.playerAction("skill"), 300);
    });
  });

  document.querySelectorAll(".enemy-section").forEach((section, index) => {
    section.addEventListener("click", () => {
      if (battle.isPlayerTurn) {
        document.querySelectorAll(".enemy-section").forEach(s => s.classList.remove("selected"));
        section.classList.add("selected");
        battle.selectedTarget = index;
        battle.updateUI();
      }
    });
  });
});
