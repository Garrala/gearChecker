import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OwnedGearService {
  private readonly STORAGE_KEY = 'ownedGear';
  private ownedGearSubject = new BehaviorSubject<{ [slot: string]: string[] }>(
    this.loadFromStorage()
  );

  ownedGear$ = this.ownedGearSubject.asObservable();

  getOwnedGear(): { [slot: string]: string[] } {
    console.log('[OwnedGearService] getOwnedGear called');
    return this.ownedGearSubject.value;
  }

  updateOwnedGear(newGear: { [slot: string]: string[] }) {
    console.log('[OwnedGearService] updateOwnedGear called with:', newGear);
    this.ownedGearSubject.next(newGear);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newGear));
    console.log('[OwnedGearService] localStorage updated');
  }

  toggleItem(slot: string, item: string) {
    console.log(`[OwnedGearService] toggleItem called - Slot: ${slot}, Item: ${item}`);
    const gear = structuredClone(this.getOwnedGear());
    console.log('[OwnedGearService] Cloned gear:', gear);

    if (!Array.isArray(gear[slot])) {
      console.log(`[OwnedGearService] gear[${slot}] was undefined, initializing to []`);
      gear[slot] = [];
    }

    const index = gear[slot].indexOf(item);
    if (index >= 0) {
      console.log(`[OwnedGearService] Item found in ${slot}, removing`);
      gear[slot].splice(index, 1);
    } else {
      console.log(`[OwnedGearService] Item not found in ${slot}, adding`);
      gear[slot].push(item);
    }

    // Mirror Weapon <-> Special Attack
    if (slot === 'Weapon') {
      console.log('[OwnedGearService] Clearing from Special Attack if mirrored');
      gear['Special Attack'] = gear['Special Attack']?.filter(i => i !== item) || [];
    }
    if (slot === 'Special Attack') {
      console.log('[OwnedGearService] Clearing from Weapon if mirrored');
      gear['Weapon'] = gear['Weapon']?.filter(i => i !== item) || [];
    }

    this.updateOwnedGear(gear);
  }

  private loadFromStorage(): { [slot: string]: string[] } {
    console.log('[OwnedGearService] loadFromStorage called');
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      console.log('[OwnedGearService] Loaded from localStorage:', saved);
      return JSON.parse(saved);
    }
    console.log('[OwnedGearService] No saved gear found, initializing default');
    return {
      Weapon: [],
      "Special Attack": [],
      Shields: [],
      Helmets: [],
      Amulets: [],
      Capes: [],
      Body: [],
      Legs: [],
      Gloves: [],
      Boots: [],
      Rings: [],
      Ammo: []
    };
  }
}
