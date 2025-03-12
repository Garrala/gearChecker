import { Component, OnInit } from '@angular/core'
import { GearService } from '../../services/gear.service'
import { NgFor, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'app-gear-management',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './gear-management.component.html',
  styleUrls: ['./gear-management.component.css'],
})
export class GearManagementComponent implements OnInit {
  gearData: { [slot: string]: { [item: string]: any } } = {}
  ownedGear: { [slot: string]: string[] } = {}
  armorSlots: string[] = [
    'Shields',
    'Helmets',
    'Amulets',
    'Capes',
    'Body',
    'Legs',
    'Gloves',
    'Boots',
    'Rings',
    'Ammo',
  ]
  loading: boolean = true

  constructor(private gearService: GearService) {}

  ngOnInit() {
    this.loadGearData()

    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
    }
  }

  loadGearData() {
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data
      this.loading = false // Hide spinner once data is loaded
    })
  }

  toggleGear(slot: string, item: string) {
    // Ensure the slot exists and is an array
    if (!Array.isArray(this.ownedGear[slot])) {
      this.ownedGear[slot] = [] // ✅ Always initialize as an array
    }

    const index = this.ownedGear[slot].indexOf(item)

    if (index > -1) {
      // ✅ Remove from both Weapon and Special Attack categories if it exists
      this.ownedGear[slot].splice(index, 1)
      if (
        slot === 'Weapon' &&
        this.ownedGear['Special Attack']?.includes(item)
      ) {
        this.ownedGear['Special Attack'].splice(
          this.ownedGear['Special Attack'].indexOf(item),
          1
        )
      }
      if (
        slot === 'Special Attack' &&
        this.ownedGear['Weapon']?.includes(item)
      ) {
        this.ownedGear['Weapon'].splice(
          this.ownedGear['Weapon'].indexOf(item),
          1
        )
      }
    } else {
      // ✅ Add to both Weapon and Special Attack categories if not selected
      this.ownedGear[slot].push(item)
      if (slot === 'Weapon') {
        if (!this.ownedGear['Special Attack'])
          this.ownedGear['Special Attack'] = []
        if (!this.ownedGear['Special Attack'].includes(item))
          this.ownedGear['Special Attack'].push(item)
      }
      if (slot === 'Special Attack') {
        if (!this.ownedGear['Weapon']) this.ownedGear['Weapon'] = []
        if (!this.ownedGear['Weapon'].includes(item))
          this.ownedGear['Weapon'].push(item)
      }
    }

    localStorage.setItem('ownedGear', JSON.stringify(this.ownedGear)) // ✅ Persist
  }

  getFilteredItems(slot: string): string[] {
    if (!this.gearData[slot]) return []

    // Get all items, but exclude the first one (which is N/A)
    return Object.keys(this.gearData[slot]).slice(1)
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj)
  }
}
