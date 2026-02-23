import { Item } from "./Item.js";

export class Shop {
  constructor() {
    this.items = [];
    this.refreshCost = 10;
    this.generateShopItems();
  }

  generateShopItems() {
    this.items = [];
    const types = ["helmet", "armor", "gloves", "boots"];
    const rarityPool = [
      { rarity: "common", weight: 75 },
      { rarity: "rare", weight: 20 },
      { rarity: "epic", weight: 4 },
      { rarity: "legendary", weight: 1 },
    ];

    for (let i = 0; i < 6; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const rarity = this._weightedRandom(rarityPool);
      const variant = Math.floor(Math.random() * 8);
      const item = new Item(type, rarity, variant);
      item.price = this.calculatePrice(rarity);
      this.items.push(item);
    }
  }

  _weightedRandom(pool) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let rand = Math.random() * total;
    for (const entry of pool) {
      rand -= entry.weight;
      if (rand <= 0) return entry.rarity;
    }
    return pool[pool.length - 1].rarity;
  }

  calculatePrice(rarity) {
    const basePrices = {
      common: 20,
      rare: 50,
      epic: 120,
      legendary: 300,
    };
    return basePrices[rarity] || 20;
  }

  refresh() {
    this.generateShopItems();
  }

  buyItem(index) {
    if (index >= 0 && index < this.items.length) {
      const item = this.items[index];
      this.items.splice(index, 1);
      return item;
    }
    return null;
  }
}
