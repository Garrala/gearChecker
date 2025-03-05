import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MonsterService, Monster } from '../../services/monster.service'
import { GearService } from '../../services/gear.service' // ✅ Import GearService
import { NgFor, NgIf } from '@angular/common'

@Component({
  selector: 'app-monster-overview',
  standalone: true,
  imports: [NgFor, NgIf, CommonModule],
  templateUrl: './monster-overview.component.html',
  styleUrls: ['./monster-overview.component.css'],
})
export class MonsterOverviewComponent implements OnInit {
  monsters: Monster[] = []
  selectedMonster: Monster | null = null
  selectedSetup: string = 'Magic' // Default tab
  gearData: {
    [slot: string]: { [item: string]: { image: string; wiki: string } }
  } = {} // ✅ Store data from multiple JSONs
  ownedGear: { [key: string]: string[] } = {} // ✅ Store multiple items per slot
  recommendedGear: { [key: string]: string[] } = {}
  isMonsterListLoading: boolean = true
  isMonsterDetailsLoading: boolean = false

  constructor(
    private monsterService: MonsterService,
    public gearService: GearService
  ) {}

  ngOnInit() {
    console.log('Initializing MonsterOverviewComponent...')

    console.log('Fetching Monsters...')
    this.monsterService.getMonsters().subscribe((data) => {
      this.monsters = data
      this.isMonsterListLoading = false // ✅ Boss list loaded
      console.log('Fetched Monsters Data:', this.monsters)
    })

    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
      console.log('Loaded Owned Gear:', this.ownedGear)
    }

    this.loadGearData() // ✅ Load multiple gear files
  }

  selectMonster(monster: Monster) {
    if (this.selectedMonster === monster) {
      // ✅ Clicking again hides the details
      this.selectedMonster = null
      return
    }

    this.isMonsterDetailsLoading = true // ✅ Show loading spinner
    setTimeout(() => {
      this.selectedMonster = monster
      this.selectedSetup = Object.keys(monster.gear_setups)[0]
      this.isMonsterDetailsLoading = false // ✅ Hide spinner once loaded
      console.log('Selected Monster:', this.selectedMonster)
      this.updateLoadout()
    }, 500) // Simulated loading delay
  }

  getGearSetups(monster?: Monster) {
    //console.log("Fetching gear setups for:", monster?.name);
    return monster ? Object.keys(monster.gear_setups) : []
  }

  getGearSlots(monster: Monster | null | undefined): string[] {
    if (!monster?.gear_setups || !monster?.gear_setups[this.selectedSetup]) {
      return []
    }
    return Object.keys(monster.gear_setups[this.selectedSetup])
  }

  isGearOwned(slot: string): boolean {
    if (!this.selectedMonster || !this.selectedSetup) return false

    const recommendedList =
      this.selectedMonster.gear_setups[this.selectedSetup][slot] || []
    const ownedItems = this.ownedGear[slot] || [] // Ensure it's an array

    const isOwned = recommendedList.some(
      (group) =>
        (Array.isArray(group) ? group : [group]).some((item) =>
          ownedItems.includes(item)
        ) // ✅ Ensure group is an array
    )

    console.log(`Is gear owned for slot "${slot}"?`, isOwned)
    return isOwned
  }

  getBestAvailableGear(slot: string): string[] {
    if (!this.selectedMonster || !this.selectedSetup) return ['None']

    // ✅ Load the final loadout from storage
    const characterLoadout = JSON.parse(
      localStorage.getItem('characterLoadout') || '{}'
    )

    return characterLoadout[slot] && characterLoadout[slot].length > 0
      ? characterLoadout[slot]
      : ['None']
  }

  /** ✅ Load all gear files from GearService **/
  loadGearData() {
    console.log('Fetching gear data...')
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data
      console.log('Loaded Gear Data:', this.gearData)
    })
  }

  /** ✅ Dynamically adjust the number of columns based on the largest set **/
  getFilledItemGroups(slot: string, monster?: Monster): string[][] {
    if (!monster || !monster.gear_setups?.[this.selectedSetup]?.[slot]) {
      console.log(`⚠️ No data found for slot: ${slot}. Returning [['N/A']]`)
      return [['N/A']]
    }

    const itemsRaw = monster.gear_setups[this.selectedSetup][slot] || []
    const items: string[][] = itemsRaw.map((group) =>
      Array.isArray(group) ? group : [group]
    )

    console.log('🔍 Recommended items for', slot, ':', items)

    // ✅ Find the max column count based on the largest item set across all slots
    const maxColumns = Math.max(
      ...Object.values(monster.gear_setups[this.selectedSetup]).map(
        (set) => set.length
      ),
      1
    )

    // ✅ Fill up the remaining spots with "N/A" if needed
    const filledItems: string[][] = [...items]
    while (filledItems.length < maxColumns) {
      filledItems.push(['N/A'])
    }

    // 🔥 Save **all** recommended items for the slot
    this.recommendedGear[slot] = filledItems.map((group) => group[0]) // ✅ Store **array** of items per slot
    localStorage.setItem(
      'recommendedGear',
      JSON.stringify(this.recommendedGear)
    )

    console.log(
      `✅ Saved Recommended Gear for ${slot}:`,
      this.recommendedGear[slot]
    )
    this.updateLoadout()
    return filledItems
  }

  updateLoadout() {
    console.log(
      '🛠 Recommended Gear Check:',
      localStorage.getItem('recommendedGear')
    )

    if (!this.selectedMonster || !this.selectedMonster.gear_setups) return

    console.log('Updating Loadout for:', this.selectedMonster.name)

    // ✅ Load ownedGear from storage
    const storedOwnedGear = localStorage.getItem('ownedGear')
    this.ownedGear = storedOwnedGear ? JSON.parse(storedOwnedGear) : {}

    // ✅ Load recommendedGear from storage
    const storedRecommendedGear = localStorage.getItem('recommendedGear')
    this.recommendedGear = storedRecommendedGear
      ? JSON.parse(storedRecommendedGear)
      : {}

    const characterLoadout: { [slot: string]: string[] } = {} // ✅ Store multiple best items

    for (const slot of Object.keys(
      this.selectedMonster.gear_setups[this.selectedSetup]
    )) {
      const recommendedItems = this.recommendedGear[slot] || []
      const ownedItems = this.ownedGear[slot] || []

      // ✅ If there are no recommended items, mark the slot as "None"
      if (!recommendedItems.length) {
        characterLoadout[slot] = ['None']
        continue
      }

      // ✅ Find all **owned** items from the recommended list
      const bestItems = recommendedItems.filter((item) =>
        ownedItems.includes(item)
      )

      // ✅ If we found matching owned items, store them; otherwise, set "None"
      characterLoadout[slot] = bestItems.length > 0 ? bestItems : ['None']
    }

    console.log('✅ Final Character Loadout:', characterLoadout)
    localStorage.setItem('characterLoadout', JSON.stringify(characterLoadout))

    this.ownedGear = characterLoadout // ✅ Assign the updated loadout correctly
  }

  isBestOwnedItem(slot: string, item: string): boolean {
    const characterLoadout = JSON.parse(
      localStorage.getItem('characterLoadout') || '{}'
    )

    // ✅ Compare against an array instead of a single string
    return (
      Array.isArray(characterLoadout[slot]) &&
      characterLoadout[slot].includes(item)
    )
  }
}
