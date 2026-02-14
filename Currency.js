export class Currency {
    constructor() {
        this.gold = 0; // Vàng khởi đầu
    }

    add(amount) {
        this.gold += amount;
    }

    spend(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }

    canAfford(amount) {
        return this.gold >= amount;
    }

    getGold() {
        return this.gold;
    }
}