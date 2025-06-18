import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MonsterService, Monster } from '../../services/monster.service'
import { GearService } from '../../services/gear.service' // ✅ Import GearService
import { NgFor, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router';
import { ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-monster-overview',
  standalone: true,
  imports: [NgFor, NgIf, CommonModule, FormsModule],
  templateUrl: './monster-overview.component.html',
  styleUrls: ['./monster-overview.component.css'],
})
export class MonsterOverviewComponent implements OnInit {
  monsters: Monster[] = []
  selectedMonster: Monster | null = null
  selectedSetup: string = 'Magic' // Default tab
  selectedBossIndex: number = 0 // ✅ Track current boss in multi-boss fights
  gearData: {
    [slot: string]: {
      [item: string]: { image: string; wiki: string; twoHanded: string }
    }
  } = {} // ✅ Store data from multiple JSONs
  ownedGear: { [key: string]: string[] } = {} // ✅ Store multiple items per slot
  recommendedGear: { [key: string]: string[] } = {}
  isMonsterListLoading: boolean = true
  isMonsterDetailsLoading: boolean = false
  isSlayerHelmEnabled: boolean = true
  gearSlots: string[] = [
    'Helmet',
    'Cape',
    'Amulet',
    'Ammo',
    'Weapon',
    'Body',
    'Shield',
    'Special Attack',
    'Legs',
    'Gloves',
    'Boots',
    'Ring',
  ]

  //Boss filtering
  selectedCategories: string[] = []
  bossCategories = [
    'World Bosses',
    'Wilderness Bosses',
    'Instanced Bosses',
    'Desert Treasure II',
    'Sporadic Bosses',
    'Slayer Bosses',
  ]

  //Item filtering
  itemSearchQuery: string = ''
  filteredBosses: Monster[] = []
  suggestedItems: { name: string; image: string }[] = []
  allItems: { name: string; image: string }[] = []

  @ViewChild('monsterDetails') monsterDetailsRef!: ElementRef;

  constructor(
    private monsterService: MonsterService,
    public gearService: GearService,
    private cdRef: ChangeDetectorRef, 
	private route: ActivatedRoute,
	private router: Router
  ) {}

  ngOnInit() {
    console.log('Initializing MonsterOverviewComponent...')

    console.log('Fetching Monsters...')
    this.monsterService.getMonsters().subscribe((data) => {
      this.monsters = data
      this.filteredBosses = data
      this.extractAllItems()
      this.isMonsterListLoading = false // ✅ Boss list loaded
	  
	  this.route.paramMap.subscribe((params) => {
        const monsterName = params.get('name');
        if (monsterName) {
          const decoded = decodeURIComponent(monsterName);
          const match = this.monsters.find(m => m.slug === monsterName);
          if (match) {
            this.selectMonster(match);
          }
        }
      });
      //console.log('Fetched Monsters Data:', this.monsters)
    })
	
	

    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
      //console.log('Loaded Owned Gear:', this.ownedGear)
    }

    this.loadGearData() // ✅ Load multiple gear files
  }

  /** ✅ Select a monster and reset boss index **/
  selectMonster(monster: Monster) {
    const currentSlug = this.selectedMonster?.slug;
    const isSameMonster = currentSlug === monster.slug;
    const targetUrl = `/monster/${monster.slug}`;

    if (isSameMonster) {
      // ✅ Clicking again hides the details
      this.selectedMonster = null
      return
    }

    this.isMonsterDetailsLoading = true // ✅ Show loading spinner

    if (this.router.url !== targetUrl) {
      this.router.navigate([targetUrl]);
    }

    // Delay setting monster and running logic
    setTimeout(() => {
      this.selectedMonster = monster;
      this.selectedBossIndex = 0;
      this.selectedSetup = Object.keys(monster.gear_setups)[0];
      this.isMonsterDetailsLoading = false;
      this.updateLoadout();

      setTimeout(() => {
        this.cdRef.detectChanges();
        this.monsterDetailsRef?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }, 100);
  }

  getGearSetups() {
    return this.selectedMonster?.gear_setups
      ? Object.keys(this.selectedMonster.gear_setups)
      : []
  }

  getGearSlots(): string[] {
    if (!this.selectedMonster || !this.selectedMonster.gear_setups) return []
    const rawSlots = Object.keys(
      this.selectedMonster.gear_setups[this.selectedSetup] || {}
    )

    const preferredOrder = [
      'Weapon',
      'Special Attack',
      'Shield',
      'Helmet',
      'Amulet',
      'Cape',
      'Body',
      'Legs',
      'Gloves',
      'Boots',
      'Ring',
      'Ammo',
    ]

    // Custom sort: by index in preferredOrder, unknowns at end, N/A at very end
    return rawSlots
      .sort((a, b) => {
        const aIndex = preferredOrder.indexOf(a)
        const bIndex = preferredOrder.indexOf(b)

        // First, prioritize defined order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1

        // Otherwise keep default
        return a.localeCompare(b)
      })
      .sort((a, b) => {
        const isAEmpty =
          this.selectedMonster!.gear_setups[this.selectedSetup][a].every(
            (group: string[] | string) =>
              Array.isArray(group)
                ? group.every((item) => item === 'N/A')
                : group === 'N/A'
          )
        const isBEmpty =
          this.selectedMonster!.gear_setups[this.selectedSetup][b].every(
            (group: string[] | string) =>
              Array.isArray(group)
                ? group.every((item) => item === 'N/A')
                : group === 'N/A'
          )

        // Push all-N/A slots to bottom
        if (isAEmpty && !isBEmpty) return 1
        if (!isAEmpty && isBEmpty) return -1
        return 0
      })
  }

  isGearOwned(slot: string): boolean {
    if (!this.selectedMonster || !this.selectedSetup) return false

    const recommendedList =
      this.selectedMonster.gear_setups[this.selectedSetup][slot] || []
    const ownedItems = this.ownedGear[slot] || [] 

    const isOwned = recommendedList.some(
      (group) =>
        (Array.isArray(group) ? group : [group]).some((item) =>
          ownedItems.includes(item)
        ) 
    )
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
    //console.log('Fetching gear data...')
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data
    })
  }

  /** ✅ Dynamically adjust the number of columns based on the largest set **/
  getFilledItemGroups(slot: string, monster?: Monster): string[][] {
    if (!monster || !monster.gear_setups?.[this.selectedSetup]?.[slot]) {
      return [['N/A']]
    }

    const itemsRaw = monster.gear_setups[this.selectedSetup][slot] || []
    const items: string[][] = itemsRaw.map((group) =>
      Array.isArray(group) ? group : [group]
    )

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
    return filledItems
  }

  updateLoadout() {
    console.log('🛠 Updating Loadout for:', this.selectedMonster?.name)

    if (!this.selectedMonster || !this.selectedMonster.gear_setups) return

    //console.log('Loading gear data from localStorage...')
    const storedOwnedGear = localStorage.getItem('ownedGear')
    this.ownedGear = storedOwnedGear ? JSON.parse(storedOwnedGear) : {}

    //console.log('Loaded Owned Gear:', this.ownedGear)

    const storedRecommendedGear = localStorage.getItem('recommendedGear')
    this.recommendedGear = storedRecommendedGear
      ? JSON.parse(storedRecommendedGear)
      : {}

    const characterLoadout: { [slot: string]: string[] } = {}

    for (const slot of Object.keys(
      this.selectedMonster.gear_setups[this.selectedSetup]
    )) {
      const recommendedItems =
        this.selectedMonster?.gear_setups?.[this.selectedSetup]?.[slot] || []
      const slotMapping: { [key: string]: string } = {
        Shield: 'Shields',
        Glove: 'Gloves',
        Boot: 'Boots',
        Helmet: 'Helmets',
        Amulet: 'Amulets',
        Cape: 'Capes',
        Body: 'Body',
        Legs: 'Legs',
        Ring: 'Rings',
        Ammo: 'Ammo',
        'Special Attack': 'Special Attack',
      }
      const normalizedSlot = slotMapping[slot] || slot
      let ownedItems = this.ownedGear[normalizedSlot] || []

      if (!recommendedItems.length) {
        characterLoadout[slot] = ['None']
        continue
      }

      const flattenedRecommendedItems = recommendedItems.flat()
      let bestItems = flattenedRecommendedItems.filter((item) =>
        ownedItems.includes(item)
      )
      if (!this.isSlayerHelmEnabled) {
        bestItems = bestItems.filter(
          (item) => !['Slayer helmet (i)', 'Black mask (i)'].includes(item)
        )
      }

      characterLoadout[slot] = bestItems.length > 0 ? bestItems : ['None']

      if (characterLoadout[slot].includes('None')) {
      }
    }

    // ✅ Check if the weapon is two-handed and clear the shield slot
    const equippedWeapon = characterLoadout['Weapon']?.[0]
    if (
      equippedWeapon &&
      this.gearData['weapons']?.[equippedWeapon]?.twoHanded
    ) {
      characterLoadout['Shield'] = ['None']
    }

    console.log('✅ Final Character Loadout:', characterLoadout)
    localStorage.setItem('characterLoadout', JSON.stringify(characterLoadout))
    this.ownedGear = { ...this.ownedGear, ...characterLoadout }
    console.log(
      'Updated ownedGear after applying characterLoadout:',
      this.ownedGear
    )
    this.cdRef.detectChanges()
  }

  isBestOwnedItem(slot: string, item: string): boolean {
    //console.log("Recommended Gear Before Update:", this.recommendedGear);
    //console.log("Owned Gear Before Update:", this.ownedGear);
    //console.log("Applying Loadout Logic...");

    const characterLoadout = JSON.parse(
      localStorage.getItem('characterLoadout') || '{}'
    )

    // ✅ Compare against an array instead of a single string
    return (
      Array.isArray(characterLoadout[slot]) &&
      characterLoadout[slot].includes(item)
    )
  }

  toggleSlayerHelm() {
    this.isSlayerHelmEnabled = !this.isSlayerHelmEnabled // ✅ Toggle state
    console.log('Toggled Slayer Helm:', this.isSlayerHelmEnabled)

    this.updateLoadout()

    // ✅ Force change detection by creating a new reference
    this.ownedGear = { ...this.ownedGear }

    console.log('Updated ownedGear after toggling Slayer Helm:', this.ownedGear)

    this.cdRef.detectChanges()
  }

  changeSetup(setup: string) {
    this.selectedSetup = setup
    //console.log(`🔄 Switching setup to: ${setup}`)
    this.updateLoadout() // ✅ Refresh loadout when changing setups
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : []
  }

  handleImageError(event: Event) {
    const target = event.target as HTMLImageElement
    target.src = 'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c' // Replace with your fallback image
  }

  /** ✅ Checks if the selected monster has multiple bosses **/
  isMultiBoss(monster: Monster | null): boolean {
    return !!monster?.bosses && monster.bosses.length > 1
  }

  getSelectedBoss(): Monster['bosses'][0] | null {
    if (!this.selectedMonster) return null
    return this.selectedMonster.bosses[this.selectedBossIndex]
  }

  /** ✅ Switch bosses in a multi-boss encounter **/
  switchBoss(index: number) {
    if (!this.isMultiBoss(this.selectedMonster)) return
    this.selectedBossIndex = index
  }

  toggleCategory(category: string) {
    console.log('called toggle category with', category)
    console.log('selected Categories before', this.selectedCategories)
    if (this.selectedCategories.includes(category)) {
      this.selectedCategories = this.selectedCategories.filter(
        (c) => c !== category
      )
    } else {
      this.selectedCategories.push(category)
    }
    console.log('selected Categories after', this.selectedCategories)
  }

  filteredMonsters(): Monster[] {
    let monsters = this.monsters

    // Filter by category if categories are selected
    if (this.selectedCategories.length > 0) {
      monsters = monsters.filter((monster) =>
        this.selectedCategories.includes(monster.category)
      )
    }

    // Filter by item if an item search is active
    const query = this.itemSearchQuery.trim().toLowerCase()
    if (query) {
      monsters = monsters.filter((monster) =>
        Object.values(monster.gear_setups || {}).some((setup) =>
          Object.values(setup).some((gearSlots) =>
            gearSlots.some((group) =>
              (Array.isArray(group) ? group : [group]).some((item) =>
                item.toLowerCase().includes(query)
              )
            )
          )
        )
      )
    }

    return monsters
  }

  /** ✅ Extract all unique items from bosses for autocomplete with images **/
  extractAllItems() {
    const itemSet = new Set<{ name: string; image: string }>();

    this.monsters.forEach((monster) => {
      Object.values(monster.gear_setups || {}).forEach((setup) => {
        Object.entries(setup).forEach(([slot, gearSlots]) => {
          gearSlots.forEach((group) => {
            const items = Array.isArray(group) ? group : [group];
            items.forEach((item) => {
              itemSet.add({
                name: item,
                image: this.gearData[slot]?.[item]?.image ||
                  `https://oldschool.runescape.wiki/images/${item.replace(/ /g, '_')}.png`,
              });
            });
          });
        });
      });
    });

    this.allItems = Array.from(itemSet);
  }

  /** Filters suggestions for autocomplete (ensures unique items) **/
  updateSuggestions() {
    const query = this.itemSearchQuery.trim().toLowerCase();

    if (!query) {
      this.suggestedItems = [];
      return;
    }

    // ✅ Use a Set to ensure unique items
    const uniqueItems = new Map<string, { name: string; image: string }>();

    this.allItems.forEach((item) => {
      if (item.name.toLowerCase().includes(query) && !uniqueItems.has(item.name)) {
        uniqueItems.set(item.name, item);
      }
    });

    this.suggestedItems = Array.from(uniqueItems.values()).slice(0, 5); // Limit to 5 suggestions
  }


  /** Select an item from autocomplete **/
  selectSuggestedItem(item: { name: string; image: string }) {
    this.itemSearchQuery = item.name
    this.suggestedItems = []
    this.filterByItem()
  }                                      

  /** Filter bosses based on selected gear item **/
  filterByItem() {
    const query = this.itemSearchQuery.trim().toLowerCase()

    if (!query) {
      this.filteredBosses = this.monsters
      return
    }

    this.filteredBosses = this.monsters.filter((monster) =>
      Object.values(monster.gear_setups || {}).some((setup) =>
        Object.values(setup).some((gearSlots) =>
          gearSlots.some((group) =>
            (Array.isArray(group) ? group : [group]).some((item) =>
              item.toLowerCase().includes(query)
            )
          )
        )
      )
    )
  }
}
