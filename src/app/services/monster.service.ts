import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'

export interface Monster {
  name: string
  image: string
  category: string
  slug: string;
  bosses: {
    name: string
    image: string
    wiki_link: string
    combat_level: number
    hp: number
    max_hit: { [key: string]: number }
    weaknesses: { [key: string]: string }
    attack_styles?: string[]
    attack_speed?: number
    defense: {
      melee: { stab: number; slash: number; crush: number }
      magic: number
      ranged: { bolts: number; arrows: number; thrown: number }
    }
    immunities?: {
      poison?: boolean
      venom?: boolean
      cannons?: boolean
      thralls?: boolean
    }
  }[]
  gear_setups: { [tab: string]: { [slot: string]: string[] } }
  selected?: boolean
}

@Injectable({
  providedIn: 'root',
})
export class MonsterService {
  private monsterListUrl = 'assets/monsters/monster-list.json'

  constructor(private http: HttpClient) {}

  getMonsters(): Observable<Monster[]> {
  return this.http.get<string[]>(this.monsterListUrl).pipe(
    switchMap((monsterFiles) => {
      const urls = monsterFiles.map((file) => `assets/monsters/${file}.json`)
      return forkJoin(urls.map((url) => this.http.get<Monster>(url)))
    }),
    map((monsters) =>
      monsters.map((monster) => ({
        ...monster,
        slug: this.generateSlug(monster.name),
      }))
      )
    )
  }

  
  private generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"]/g, '')           // remove apostrophes and quotes
    .replace(/[^a-z0-9]+/g, '-')    // replace non-alphanumerics with dash
    .replace(/(^-|-$)+/g, '')       // remove leading/trailing dashes
  }
}
