import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, forkJoin, map } from 'rxjs'

@Injectable({
  providedIn: 'root',
})
export class GearService {
  private gearFiles = [
    'weapons.json',
    'special_attack.json',
    'helmets.json',
    'amulets.json',
    'capes.json',
    'body.json',
    'legs.json',
    'gloves.json',
    'boots.json',
    'rings.json',
    'ammo.json',
    'shields.json',
  ]

  private basePath = 'assets/gear/'

  ownedGear: { [slot: string]: string[] } = {} // ✅ Always an object with arrays
  // ✅ Make sure it's always an array

  constructor(private http: HttpClient) {
    this.loadOwnedGear()
  }

  getGearData(): Observable<{ [slot: string]: { [item: string]: any } }> {
    const requests = this.gearFiles.map((file) => {
      return this.http.get<{ [item: string]: any }>(this.basePath + file)
    })

    return forkJoin(requests).pipe(
      map((responses) => {
        const gearData: { [slot: string]: { [item: string]: any } } = {}
        this.gearFiles.forEach((file, index) => {
          const slotName = file.replace('.json', '') // Extract slot name from filename
          gearData[slotName] = responses[index]
        })
        return gearData
      })
    )
  }

  // Toggle gear selection and persist it
  updateOwnedGear(slot: string, item: string) {
    if (!this.ownedGear[slot]) {
      this.ownedGear[slot] = [] // ✅ Always initialize as an array
    }

    const index = this.ownedGear[slot].indexOf(item)

    if (index > -1) {
      this.ownedGear[slot].splice(index, 1) // ✅ Remove if already selected
    } else {
      this.ownedGear[slot].push(item) // ✅ Add if not selected
    }

    this.saveOwnedGear() // ✅ Persist selections
  }

  getOwnedGear(): { [slot: string]: string[] } {
    const storedGear = localStorage.getItem('ownedGear')
    return storedGear ? JSON.parse(storedGear) : {}
  }

  private saveOwnedGear() {
    localStorage.setItem('ownedGear', JSON.stringify(this.ownedGear))
  }

  // Load from local storage
  private loadOwnedGear() {
    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
    }
  }

  getGearCategory(slot: string): string {
    const slotMap: { [key: string]: string } = {
      Weapon: 'weapons',
      'Special Attack': 'special_attack',
      Helmet: 'helmets',
      Amulet: 'amulets',
      Cape: 'capes',
      Body: 'body',
      Legs: 'legs',
      Gloves: 'gloves',
      Boots: 'boots',
      Ring: 'rings',
      Ammo: 'ammo',
      Shield: 'shields',
    }

    const category = slotMap[slot] || slot.toLowerCase() 
    return category
  }
}
