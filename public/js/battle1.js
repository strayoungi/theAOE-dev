// Battle RPG Logic
class Character {
    constructor(name, hp, mp, atk, def, skills = []) {
        this.name = name;
        this.maxHp = hp;
        this.hp = hp;
        this.maxMp = mp;
        this.mp = mp;
        this.atk = atk;
        this.def = def;
        this.skills = skills;
        this.isDefending = false;
    }

    attack(target) {
        let damage = this.atk;
        if (target.isDefending) {
            damage = Math.floor(damage / 2);
            target.isDefending = false;
        }
        target.hp = Math.max(0, target.hp - damage);
        return damage;
    }

    defend() {
        this.isDefending = true;
    }

    useSkill(skillIndex, target) {
        const skill = this.skills[skillIndex];
        if (this.mp >= skill.mpCost) {
            this.mp -= skill.mpCost;
            if (skill.damage > 0) {
                let damage = skill.damage;
                if (target.isDefending) {
                    damage = Math.floor(damage / 2);
                    target.isDefending = false;
                }
                target.hp = Math.max(0, target.hp - damage);
                return damage;
            } else {
                // Heal
                target.hp = Math.min(target.maxHp, target.hp - skill.damage);
                return -skill.damage;
            }
        }
        return 0;
    }
}

class Battle {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.isPlayerTurn = true;
        this.battleLog = [];
        this.selectedSkill = null;
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
                const damage = player.attack(this.enemy);
                message += `attacks ${this.enemy.name} for ${damage} damage!`;
                break;
            case 'defend':
                player.defend();
                message += 'defends!';
                break;
            case 'skill':
                if (this.selectedSkill !== null) {
                    const result = player.useSkill(this.selectedSkill, this.selectedSkill === 1 ? this.player : this.enemy);
                    if (result > 0) {
                        message += `uses ${player.skills[this.selectedSkill].name} on ${this.enemy.name} for ${result} damage!`;
                    } else if (result < 0) {
                        message += `uses ${player.skills[this.selectedSkill].name} and heals for ${-result} HP!`;
                    } else {
                        message += 'doesn\'t have enough MP!';
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
        const damage = this.enemy.attack(this.player);
        this.logMessage(`${this.enemy.name} attacks ${this.player.name} for ${damage} damage!`);
        this.checkBattleEnd();
        if (!this.isBattleOver()) {
            this.isPlayerTurn = true;
            this.updateUI();
        }
    }

    checkBattleEnd() {
        if (this.player.hp <= 0) {
            this.logMessage("You lose!");
            this.endBattle();
        } else if (this.enemy.hp <= 0) {
            this.logMessage("You win!");
            this.endBattle();
        }
    }

    isBattleOver() {
        return this.player.hp <= 0 || this.enemy.hp <= 0;
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
        playerCard.querySelector('.stat:nth-child(2)').textContent = `HP: ${this.player.hp} / ${this.player.maxHp}`;
        playerCard.querySelector('.stat:nth-child(3)').textContent = `MP: ${this.player.mp} / ${this.player.maxMp}`;
        const playerHealthBar = playerCard.querySelector('.health-bar-fill');
        playerHealthBar.style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;

        // Update enemy stats
        const enemyCard = document.querySelector('.enemy-section .status-card');
        enemyCard.querySelector('.name').textContent = this.enemy.name;
        enemyCard.querySelector('.stat:nth-child(2)').textContent = `HP: ${this.enemy.hp} / ${this.enemy.maxHp}`;
        const enemyHealthBar = enemyCard.querySelector('.health-bar-fill');
        enemyHealthBar.style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;

        // Update turn indicator
        const turnIndicator = document.querySelector('.turn-indicator');
        turnIndicator.textContent = this.isPlayerTurn ? `${this.player.name}'s turn` : `${this.enemy.name}'s turn`;

        // Disable/enable controls based on turn
        document.querySelectorAll('.btn').forEach(btn => {
            btn.disabled = !this.isPlayerTurn;
            btn.style.opacity = this.isPlayerTurn ? '1' : '0.5';
        });
        document.querySelectorAll('.skill-card').forEach(skill => {
            skill.style.pointerEvents = this.isPlayerTurn ? 'auto' : 'none';
            skill.style.opacity = this.isPlayerTurn ? '1' : '0.5';
        });
    }

    updateBattleLog() {
        const logElement = document.querySelector('.battle-log');
        logElement.innerHTML = this.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join('');
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// Initialize battle
const player = new Character('Hero A', 150, 50, 25, 15, [
    { name: 'Fireball', damage: 40, mpCost: 10 },
    { name: 'Heal', damage: -30, mpCost: 15 }
]);
const enemy = new Character('Goblin', 100, 0, 20, 5);

const battle = new Battle(player, enemy);

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    battle.startBattle();

    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.textContent === 'Attack') {
                battle.playerAction('attack');
            } else if (btn.textContent === 'Defend') {
                battle.playerAction('defend');
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
});