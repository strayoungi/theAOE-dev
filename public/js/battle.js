// Battle RPG Logic
class Character {
    constructor(name, hp, mp, atk, def, attackMultiplier, critRate = 0, critDamage = 1.5, skills = []) {
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
        this.shield = 0;
        this.skills = skills;
        this.buffs = [];
    }

    attack(target) {
        let baseDamage = (this.atk * this.attackMultiplier) - target.def;
        let { damage, isCrit } = this.calculateDamage(baseDamage);
        let absorbed = 0;
        if (target.shield > 0) {
            absorbed = Math.min(damage, target.shield);
            target.shield -= absorbed;
            damage -= absorbed;
        }
        target.hp = Math.max(0, target.hp - damage);
        return { damage: damage + absorbed, absorbed, isCrit }; // Total damage attempted
    }

    calculateDamage(baseDamage) {
        let isCrit = Math.random() < this.critRate;
        let damage = baseDamage;
        if (isCrit) {
            damage *= this.critDamage;
        }
        return { damage: Math.max(0, damage), isCrit };
    }

    useSkill(skillIndex, target) {
        const skill = this.skills[skillIndex];
        if (this.mp >= skill.mpCost) {
            this.mp -= skill.mpCost;
            if (skill.effect === 'damage') {
                let baseDamage = (skill.damage * (skill.multiplier || 1)) - target.def;
                let { damage, isCrit } = this.calculateDamage(baseDamage);
                let absorbed = 0;
                if (target.shield > 0) {
                    absorbed = Math.min(damage, target.shield);
                    target.shield -= absorbed;
                    damage -= absorbed;
                }
                target.hp = Math.max(0, target.hp - damage);
                return { damage: damage + absorbed, absorbed, isCrit };
            } else if (skill.effect === 'heal') {
                target.hp = Math.min(target.maxHp, target.hp + skill.heal);
                return skill.heal;
            } else if (skill.effect === 'buff') {
                this.buffs.push({ type: skill.buffType, value: skill.buffValue, turns: skill.buffTurns });
                this.updateStats();
                return skill.buffValue;
            }
        }
        return 0;
    }

    updateStats() {
        this.atk = this.baseAtk;
        this.def = this.baseDef;
        this.critRate = this.baseCritRate;
        this.critDamage = this.baseCritDamage;
        this.shield = 0;
        this.buffs.forEach(buff => {
            if (buff.type === 'atk_percent') {
                this.atk = Math.floor(this.baseAtk * (1 + buff.value / 100));
            } else if (buff.type === 'def_percent') {
                this.def = Math.floor(this.baseDef * (1 + buff.value / 100));
            } else if (buff.type === 'crit_rate_percent') {
                this.critRate = Math.min(1, this.baseCritRate + buff.value / 100);
            } else if (buff.type === 'crit_damage_percent') {
                this.critDamage = this.baseCritDamage * (1 + buff.value / 100);
            } else if (buff.type === 'shield') {
                this.shield += buff.value;
            }
        });
    }

    endTurn() {
        this.buffs = this.buffs.filter(buff => {
            buff.turns--;
            return buff.turns > 0;
        });
        this.updateStats();
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
            case 'attack':
                const targetEnemy = this.enemies[this.selectedTarget];
                if (targetEnemy && targetEnemy.hp > 0) {
                    const result = player.attack(targetEnemy);
                    message += `attacks ${targetEnemy.name} for ${result.damage} damage!`;
                    if (result.absorbed > 0) message += ` (${result.absorbed} absorbed by shield!)`;
                    if (result.isCrit) message += ' (Critical!)';
                    // Gain 5 MP on normal attack
                    this.player.mp = Math.min(this.player.maxMp, this.player.mp + 5);
                } else {
                    message += 'tries to attack but target is defeated!';
                }
                break;
            case 'skill':
                if (this.selectedSkill !== null) {
                    const skill = player.skills[this.selectedSkill];
                    const target = (skill.effect === 'heal' || skill.effect === 'buff') ? player : this.enemies[this.selectedTarget];
                    if (target && (target.hp > 0 || skill.effect === 'heal' || skill.effect === 'buff')) {
                        const result = player.useSkill(this.selectedSkill, target);
                        if (result > 0 || (typeof result === 'object' && result.damage > 0)) {
                            if (skill.effect === 'damage') {
                                message += `uses ${skill.name} on ${target.name} for ${result.damage} damage!`;
                                if (result.absorbed > 0) message += ` (${result.absorbed} absorbed by shield!)`;
                                if (result.isCrit) message += ' (Critical!)';
                            } else if (skill.effect === 'heal') {
                                message += `uses ${skill.name} and heals for ${result} HP!`;
                            } else if (skill.effect === 'buff') {
                                let buffDesc = '';
                                if (skill.buffType === 'atk_percent') buffDesc = 'ATK';
                                else if (skill.buffType === 'def_percent') buffDesc = 'DEF';
                                else if (skill.buffType === 'crit_rate_percent') buffDesc = 'Crit Rate';
                                else if (skill.buffType === 'crit_damage_percent') buffDesc = 'Crit Damage';
                                else if (skill.buffType === 'shield') buffDesc = 'Shield';
                                message += `uses ${skill.name} and gains ${buffDesc} of ${result}!`;
                            }
                        } else {
                            message += 'doesn\'t have enough MP!';
                            return;
                        }
                    } else {
                        message += 'invalid target!';
                        return;
                    }
                }
                break;
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
        this.enemies.forEach((enemy, index) => {
            if (enemy.hp > 0) {
                const result = enemy.attack(this.player);
                let msg = `${enemy.name} attacks ${this.player.name} for ${result.damage} damage!`;
                if (result.absorbed > 0) msg += ` (${result.absorbed} absorbed by shield!)`;
                this.logMessage(msg);
            }
        });
        this.player.endTurn();
        this.enemies.forEach(enemy => enemy.endTurn());
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
        // Disable buttons or show end screen
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
        document.querySelectorAll('.skill-card').forEach(skill => skill.style.pointerEvents = 'none');
    }

    showVictoryPopup() {
        const expGained = this.enemies.length * 10;
        const coinsGained = this.enemies.length * 5;

        document.getElementById('exp-gained').textContent = expGained;
        document.getElementById('coins-gained').textContent = coinsGained;

        document.getElementById('victory-popup').style.display = 'flex';

        // Event listeners for buttons
        document.getElementById('back-to-zone').addEventListener('click', () => {
            window.location.href = 'zona1.html'; // Assuming map.html is the zone selection
        });

        document.getElementById('continue-battle').addEventListener('click', () => {
            // For now, reload the page or go to next zone
            window.location.href = 'zona1.html'; // Assuming zona1.html is the next zone
        });

        document.getElementById('view-log').addEventListener('click', () => {
            this.showBattleLog();
        });
    }

    showLosePopup() {
        document.getElementById('lose-popup').style.display = 'flex';

        // Event listeners for buttons
        document.getElementById('back-to-zone-lose').addEventListener('click', () => {
            window.location.href = 'zona1.html'; // Assuming map.html is the zone selection
        });

        document.getElementById('try-again-battle').addEventListener('click', () => {
            // For now, reload the page or go to next zone
            window.location.href = 'battle.html'; // Assuming zona1.html is the next zone
        });

        document.getElementById('view-battle-log').addEventListener('click', () => {
            this.showBattleLog();
        });
    }

    showBattleLog() {
        const logContent = document.getElementById('log-content');
        logContent.innerHTML = this.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join('');
        document.getElementById('log-modal').style.display = 'flex';

        document.getElementById('close-log').addEventListener('click', () => {
            document.getElementById('log-modal').style.display = 'none';
        });
    }

    logMessage(message) {
        this.battleLog.push(message);
        this.updateBattleLog();
    }

    updateUI() {
        // Update player stats
        const playerCard = document.querySelector('.player-section .status-card');
        playerCard.querySelector('.name').textContent = this.player.name;
        playerCard.querySelector('.stat:nth-child(3)').textContent = `HP: ${this.player.hp} / ${this.player.maxHp}`;
        playerCard.querySelector('.stat:nth-child(4)').textContent = `MP: ${this.player.mp} / ${this.player.maxMp}`;
        playerCard.querySelector('.stat:nth-child(5)').textContent = `ATK: ${this.player.atk}`;
        playerCard.querySelector('.stat:nth-child(6)').textContent = `DEF: ${this.player.def}`;
        if (this.player.shield > 0) {
            playerCard.querySelector('.stat:nth-child(7)').textContent = `Shield: ${this.player.shield}`;
        } else {
            playerCard.querySelector('.stat:nth-child(7)').textContent = '';
        }
        const playerHealthBar = playerCard.querySelector('.health-bar-fill');
        playerHealthBar.style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;

        // Update enemy stats
        const enemyCards = document.querySelectorAll('.enemy-section .status-card');
        this.enemies.forEach((enemy, index) => {
            if (enemyCards[index]) {
                enemyCards[index].querySelector('.name').textContent = enemy.name;
                enemyCards[index].querySelector('.stat:nth-child(2)').textContent = `HP: ${enemy.hp} / ${enemy.maxHp}`;
                enemyCards[index].querySelector('.stat:nth-child(3)').textContent = `ATK: ${enemy.atk}`;
                enemyCards[index].querySelector('.stat:nth-child(4)').textContent = `DEF: ${enemy.def}`;
                const enemyHealthBar = enemyCards[index].querySelector('.health-bar-fill');
                enemyHealthBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
            }
        });

        // Update turn indicator
        const turnIndicator = document.querySelector('.turn-indicator');
        turnIndicator.textContent = this.isPlayerTurn ? `${this.player.name}'s turn` : `Enemies' turn`;

        // Update selected target visual
        document.querySelectorAll('.enemy-section').forEach((section, index) => {
            section.classList.toggle('selected', index === this.selectedTarget);
            section.style.pointerEvents = this.isPlayerTurn ? 'auto' : 'none';
            section.style.opacity = this.isPlayerTurn ? '1' : '0.5';
        });
    }

    updateBattleLog() {
        const logElement = document.querySelector('.battle-log');
        logElement.innerHTML = this.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join('');
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// Initialize battle
const player = new Character('Hero A', 200, 50, 25, 15, 0.8, 0.2, 1.5, [
    { name: 'Fireball', effect: 'damage', damage: 40, multiplier: 1.2, mpCost: 10 },
    { name: 'Shadow Strike', effect: 'heal', heal: 30, mpCost: 12 },
    { name: 'Flame Burst', effect: 'buff', buffType: 'def_percent', buffValue: 10, buffTurns: 2, mpCost: 10 },
    { name: 'Critical Boost', effect: 'buff', buffType: 'crit_rate_percent', buffValue: 20, buffTurns: 2, mpCost: 15 },
    { name: 'Protective Barrier', effect: 'buff', buffType: 'shield', buffValue: 30, buffTurns: 2, mpCost: 12 }
]);
const enemies = [
    new Character('Goblin', 100, 0, 10, 20, 1.0),
    new Character('Orc', 120, 0, 15, 20, 1.0)
];

const battle = new Battle(player, enemies);

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    battle.startBattle();

    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.textContent === 'Attack') {
                battle.playerAction('attack');
            }
        });
    });

    document.querySelectorAll('.skill-card').forEach((skill, index) => {
        skill.addEventListener('click', () => {
            document.querySelectorAll('.skill-card').forEach(s => s.classList.remove('selected'));
            skill.classList.add('selected');
            battle.selectedSkill = index;
            // Auto use skill after selection
            setTimeout(() => battle.playerAction('skill'), 500);
        });
    });

    document.querySelectorAll('.enemy-section').forEach((section, index) => {
        section.addEventListener('click', () => {
            if (battle.isPlayerTurn) {
                document.querySelectorAll('.enemy-section').forEach(s => s.classList.remove('selected'));
                section.classList.add('selected');
                battle.selectedTarget = index;
            }
        });
    });
});