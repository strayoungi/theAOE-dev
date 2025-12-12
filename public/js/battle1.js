// Battle RPG Logic
class Character {
    constructor(name, hp, mp, atk, def, multiplier, skills = []) {
        this.name = name;
        this.maxHp = hp;
        this.hp = hp;
        this.maxMp = mp;
        this.mp = mp;
        this.baseAtk = atk;
        this.atk = atk;
        this.def = def;
        this.multiplier = multiplier;
        this.skills = skills;
        this.buffs = [];
    }

    attack(target) {
        let damage = Math.max(0, (this.atk * this.multiplier) - target.def);
        target.hp = Math.max(0, target.hp - damage);
        return damage;
    }

    useSkill(skillIndex, target) {
        const skill = this.skills[skillIndex];
        if (this.mp >= skill.mpCost) {
            this.mp -= skill.mpCost;
            if (skill.effect === 'damage') {
                let damage = Math.max(0, skill.damage - target.def);
                target.hp = Math.max(0, target.hp - damage);
                return damage;
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
        this.buffs.forEach(buff => {
            if (buff.type === 'atk_percent') {
                this.atk = Math.floor(this.baseAtk * (1 + buff.value / 100));
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
                    const damage = player.attack(targetEnemy);
                    message += `attacks ${targetEnemy.name} for ${damage} damage!`;
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
                        if (result > 0) {
                            if (skill.effect === 'damage') {
                                message += `uses ${skill.name} on ${target.name} for ${result} damage!`;
                            } else if (skill.effect === 'heal') {
                                message += `uses ${skill.name} and heals for ${result} HP!`;
                            } else if (skill.effect === 'buff') {
                                message += `uses ${skill.name} and boosts ATK by ${result}%!`;
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
                const damage = enemy.attack(this.player);
                this.logMessage(`${enemy.name} attacks ${this.player.name} for ${damage} damage!`);
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
        } else if (!enemiesAlive) {
            this.logMessage("You win!");
            this.endBattle();
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
const player = new Character('Hero A', 150, 50, 25, 15, 0.8, [
    { name: 'Fireball', effect: 'damage', damage: 40, mpCost: 10 },
    { name: 'Shadow Strike', effect: 'heal', heal: 30, mpCost: 12 },
    { name: 'Flame Burst', effect: 'buff', buffType: 'atk_percent', buffValue: 10, buffTurns: 2, mpCost: 10 }
]);
const enemies = [
    new Character('Goblin', 100, 0, 20, 5, 1.0),
    new Character('Orc', 120, 0, 25, 8, 1.0)
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