import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, forkJoin, Observable, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PriceService {
  private MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
  private LATEST_URL = 'https://prices.runescape.wiki/api/v1/osrs/latest';

  private itemNameToIdMap: { [name: string]: number } = {};
  private latestPrices: { [id: string]: { high: number; low: number } } = {};
  private customPriceSources: { [untradeableName: string]: string } = {
    'neitiznot faceguard': 'basilisk jaw',
    'bow of faerdhinen': 'enhanced crystal weapon seed',
    'crystal body': 'crystal armour seed',
    'crystal legs': 'crystal armour seed',
    'crystal helm': 'crystal armour seed',
    'any blessed boots': 'ancient dhide boots',
    'any blessed vambraces': 'ancient bracers',
    'any blessed body': 'ancient dhide body',
    'any blessed chaps': 'ancient chaps',
    'any blessed coif': 'ancient coif',
    'scorching bow': 'tormented synapse',
    'emberlight': 'tormented synapse',
    'purging staff': 'tormented synapse',
    'ferocious gloves': 'hydra leather',
    'trident of the swamp': 'magic fang',
    'any barrows tank body': 'torags platebody',
    'any barrows tank legs': 'torags platelegs',
    'any barrows tank helm': 'torags helm',
    'blade of saeldor': 'enhanced crystal weapon seed',
    'any god vestment cloaks': 'saradomin cloak'
  };

  private priceBlocklist = new Set<string>([
    'rune defender',
    'dragon defender',
    'anti-dragon shield'
  ]);

  constructor(private http: HttpClient) { }

  loadPrices(): Observable<void> {
    return forkJoin({
      mapping: this.http.get<any[]>(this.MAPPING_URL),
      prices: this.http.get<{ data: any }>(this.LATEST_URL),
    }).pipe(
      map(({ mapping, prices }) => {
        this.itemNameToIdMap = {};
        mapping.forEach(entry => {
          const normalized = this.normalizeItemName(entry.name);
          this.itemNameToIdMap[normalized] = entry.id;
        });

        this.latestPrices = prices.data;
      }),
      shareReplay(1)
    );
  }

  getItemPrice(itemName: string): { high: number; low: number } | null {
    const normalizedName = this.normalizeItemName(itemName);

    if (this.priceBlocklist.has(normalizedName)) {
      return null;
    }

    // 🧩 Try composite recipe first
    const compositePrice = this.getCompositeItemPrice(itemName);
    if (compositePrice) return compositePrice;

    const overrideName = this.customPriceSources[normalizedName] || normalizedName;
    const id = this.itemNameToIdMap[overrideName];
    return id ? this.latestPrices[id] : null;
  }



  isInBlocklist(name: string): boolean {
    return this.priceBlocklist.has(this.normalizeItemName(name));
  }

  findClosestMatch(name: string): number | null {
    const clean = name.toLowerCase().replace(/[\(\)]/g, '');
    const match = Object.entries(this.itemNameToIdMap).find(([wikiName]) =>
      wikiName.toLowerCase().includes(clean)
    );
    return match ? match[1] : null;
  }

  getPriceById(id: number): { high: number; low: number } | null {
    return this.latestPrices[id] || null;
  }

  normalizeItemName(name: string, category?: string): string {
    let result = name.toLowerCase().trim();

    result = result
      .replace(/\s*\(i+\)/gi, '')
      .replace(/\s*\(or\)/gi, '')
      .replace(/\s*\(f\)/gi, '')
      .replace(/\s*\(u\)/gi, '')
      .replace(/\s*\(uncharged\)/gi, '')
      .replace(/['’]/g, '') // remove apostrophes (e.g., Dizana's)
      .replace(/[^a-z0-9 ]/gi, '') // strip weird symbols (optional)
      .replace(/\s+/g, ' ') // collapse extra whitespace

    return result;
  }

  private getCompositeItemRecipes(): {
    [productName: string]: { name: string; quantity: number }[]
  } {
    return {
      'echo boots': [
        { name: 'guardian boots', quantity: 1 },
        { name: 'echo crystal', quantity: 1 }
      ],
      'saradomins blessed sword': [
        { name: 'saradomins tear', quantity: 1 },
        { name: 'saradomin sword', quantity: 1 }
      ],
      'harmonised nightmare staff': [
        { name: 'nightmare staff', quantity: 1 },
        { name: 'harmonised orb', quantity: 1 }
      ],
      'volatile nightmare staff': [
        { name: 'nightmare staff', quantity: 1 },
        { name: 'volatile orb', quantity: 1 }
      ],
      'eldritch nightmare staff': [
        { name: 'nightmare staff', quantity: 1 },
        { name: 'eldritch orb', quantity: 1 }
      ],
      'amulet of blood fury': [
        { name: 'amulet of fury', quantity: 1 },
        { name: 'blood shard', quantity: 1 }
      ],
      'abyssal tentacle': [
        { name: 'abyssal whip', quantity: 1 },
        { name: 'kraken tentacle', quantity: 1 }
      ]

      // Add more recipes here as needed
    };
  }

  private getCompositeItemPrice(itemName: string): { high: number; low: number } | null {
    const recipes = this.getCompositeItemRecipes();
    const normalizedName = this.normalizeItemName(itemName);
    const recipe = recipes[normalizedName];

    console.log(`📦 Checking composite recipe for "${normalizedName}":`, recipe);

    if (!recipe) return null;

    let high = 0;
    let low = 0;

    for (const { name, quantity } of recipe) {
      const normalizedComponent = this.normalizeItemName(name);
      const componentPrice = this.getItemPrice(name);
      console.log(`   🔩 Component: "${name}" → Normalized: "${normalizedComponent}"`);
      console.log(`   💰 Price:`, componentPrice);

      if (!componentPrice) {
        console.warn(`   ⚠️ Missing price for component: "${name}"`);
        return null;
      }

      high += componentPrice.high * quantity;
      low += componentPrice.low * quantity;
    }

    return { high, low };
  }




}
