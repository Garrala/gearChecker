import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MonsterService, Monster } from '../../services/monster.service'
import { GearService } from '../../services/gear.service' 
import { NgFor, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router';
import { ViewChild, ElementRef, ViewChildren, QueryList } from '@angular/core';

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
  selectedBossIndex: number = 0 //  Track current boss in multi-boss fights
  gearData: {
    [slot: string]: {
      [item: string]: { image: string; wiki: string; twoHanded: string; usesAmmoType: string; ammoType: string; }
    }
  } = {} //  Store data from multiple JSONs
  ownedGear: { [key: string]: string[] } = {} //  Store multiple items per slot
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

  venomToPoisonBosses = new Set([
    'Chaos Elemental',
    'Dagannoth Prime',
    'Dagannoth Rex',
    'Dagannoth Supreme',
    'Demonic Gorilla',
    'Duke Sucellus',
    'Giant Mole',
    'Kalphite Queen (Crawling)',
    'Kalphite Queen (Airborne)',
    'Kraken',
    'The Leviathan',
    'Obor',
    'Scurrius',
    'TzTok-Jad',
    'Vet\'ion'
  ]);


  //Item filtering
  itemSearchQuery: string = ''
  filteredBosses: Monster[] = []
  suggestedItems: { name: string; image: string }[] = []
  allItems: { name: string; image: string }[] = []
  highlightedIndex: number = -1;

  @ViewChild('monsterDetails') monsterDetailsRef!: ElementRef;
  @ViewChildren('itemRef') itemElements!: QueryList<ElementRef>;

  constructor(
    private monsterService: MonsterService,
    public gearService: GearService,
    private cdRef: ChangeDetectorRef, 
	  private route: ActivatedRoute,
	  private router: Router
  ) {}

  ngOnInit() {

    this.monsterService.getMonsters().subscribe((data) => {
      this.monsters = data
      this.filteredBosses = data
      this.extractAllItems()
      this.isMonsterListLoading = false //  Boss list loaded
	  
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
    })
	
	

    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
    }

    this.loadGearData() //  Load multiple gear files
  }

  /**  Select a monster and reset boss index **/
  selectMonster(monster: Monster) {
    const currentSlug = this.selectedMonster?.slug;
    const isSameMonster = currentSlug === monster.slug;
    const targetUrl = `/monster/${monster.slug}`;

    if (isSameMonster) {
      //  Clicking again hides the details
      this.selectedMonster = null
      return
    }

    this.isMonsterDetailsLoading = true //  Show loading spinner

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

    //  Load the final loadout from storage
    const characterLoadout = JSON.parse(
      localStorage.getItem('characterLoadout') || '{}'
    )

    return characterLoadout[slot] && characterLoadout[slot].length > 0
      ? characterLoadout[slot]
      : ['None']
  }

  /**  Load all gear files from GearService **/
  loadGearData() {
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data
    })
  }

  /**  Dynamically adjust the number of columns based on the largest set **/
  getFilledItemGroups(slot: string, monster?: Monster): string[][] {
    if (!monster || !monster.gear_setups?.[this.selectedSetup]?.[slot]) {
      return [['N/A']]
    }

    const itemsRaw = monster.gear_setups[this.selectedSetup][slot] || []
    const items: string[][] = itemsRaw.map((group) =>
      Array.isArray(group) ? group : [group]
    )

    //  Find the max column count based on the largest item set across all slots
    const maxColumns = Math.max(
      ...Object.values(monster.gear_setups[this.selectedSetup]).map(
        (set) => set.length
      ),
      1
    )

    //  Fill up the remaining spots with "N/A" if needed
    const filledItems: string[][] = [...items]
    while (filledItems.length < maxColumns) {
      filledItems.push(['N/A'])
    }

    //  Save **all** recommended items for the slot
    this.recommendedGear[slot] = filledItems.map((group) => group[0]) // ✅ Store **array** of items per slot
    localStorage.setItem(
      'recommendedGear',
      JSON.stringify(this.recommendedGear)
    )
    return filledItems
  }

  updateLoadout() {

    if (!this.selectedMonster || !this.selectedMonster.gear_setups) return

    const storedOwnedGear = localStorage.getItem('ownedGear')
    this.ownedGear = storedOwnedGear ? JSON.parse(storedOwnedGear) : {}


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

      // ✅ Determine compatible ammo
      const weaponName = characterLoadout['Weapon']?.[0];
      const weaponData = this.gearData['weapons']?.[weaponName];

      if (weaponData && weaponData.usesAmmoType) {
        const expectedAmmoType = weaponData.usesAmmoType;
        const ammoOptions = this.selectedMonster?.gear_setups?.[this.selectedSetup]?.['Ammo'] || [];
        const ownedAmmo = this.ownedGear['Ammo'] || [];

        const compatibleAmmo = (ammoOptions.flat() as string[]).filter(ammoName => {
          const ammoData = this.gearData['ammo']?.[ammoName];
          return ammoData?.ammoType === expectedAmmoType && ownedAmmo.includes(ammoName);
        });

        characterLoadout['Ammo'] = compatibleAmmo.length > 0 ? compatibleAmmo : ['None'];
      } else {
        characterLoadout['Ammo'] = ['None'];
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

    localStorage.setItem('characterLoadout', JSON.stringify(characterLoadout))
    this.ownedGear = { ...this.ownedGear, ...characterLoadout }
    
    this.cdRef.detectChanges()
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

  toggleSlayerHelm() {
    this.isSlayerHelmEnabled = !this.isSlayerHelmEnabled // ✅ Toggle state
    

    this.updateLoadout()

    // ✅ Force change detection by creating a new reference
    this.ownedGear = { ...this.ownedGear }

    this.cdRef.detectChanges()
  }

  changeSetup(setup: string) {
    this.selectedSetup = setup
    this.updateLoadout() // ✅ Refresh loadout when changing setups
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : []
  }

  handleImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    const brokenSrc = target.src;
    console.warn(`Image failed to load: ${brokenSrc}`);
    target.src = 'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c'; // or your local fallback
  }


  /** ✅ Checks if the selected monster has multiple bosses **/
  isMultiBoss(monster: Monster | null): boolean {
    return !!monster?.bosses && monster.bosses.length > 1
  }


  getSelectedBoss(): Monster['bosses'][0] | null {
    if (!this.selectedMonster) return null;
    return this.getOrderedBossPhases(this.selectedMonster)[this.selectedBossIndex];
  }

  switchBoss(index: number): void {
    this.selectedBossIndex = index;
  }

  toggleCategory(category: string) {
    if (this.selectedCategories.includes(category)) {
      this.selectedCategories = this.selectedCategories.filter(
        (c) => c !== category
      )
    } else {
      this.selectedCategories.push(category)
    }
  }

  filteredMonsters(): Monster[] {
    let monsters = this.monsters;

    // Filter by category if categories are selected
    if (this.selectedCategories.length > 0) {
      monsters = monsters.filter((monster) =>
        this.selectedCategories.includes(monster.category)
      );
    }

    // Filter by item if an item search is active
    const query = this.itemSearchQuery.trim().toLowerCase();
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
      );
    }

    // Override image with first ordered phase's image
    return monsters.map(monster => {
      const primaryPhase = this.getOrderedBossPhases(monster)[0];
      return {
        ...monster,
        image: primaryPhase?.image ?? monster.image,
      };
    });
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

  getAttackSpeedDisplay(): string {
    const atkSpeed = this.getSelectedBoss()?.attack_speed;

    if (this.isAttackSpeedObject(atkSpeed)) {
      const seconds = atkSpeed.seconds !== undefined ? ` (${atkSpeed.seconds}s)` : '';
      return `${atkSpeed.ticks} ticks${seconds}`;
    }

    return typeof atkSpeed === 'number' ? `${atkSpeed} ticks` : 'Varies';
  }


  isAttackSpeedObject(value: any): value is { ticks: number; seconds?: number } {
    return value && typeof value === 'object' && 'ticks' in value;
  }

  getCleanBossName(rawName?: string): string {
    if (!rawName) return 'Unknown';
    console.log(rawName)
    // Manual cleanup rules
    const replacements: { [key: string]: string } = {
      'duke sucellus (sucellus awake awakened)': 'Duke Sucellus (Awakened)',
      'duke sucellus (sucellus awake post quest)': 'Duke Sucellus (Post Quest)',
      'duke sucellus (sucellus awake quest)': 'Duke Sucellus (Quest)',
      'the leviathan (leviathan awakened)': 'The Leviathan (Awakened)',
      'the leviathan (leviathan post quest)': 'The Leviathan (Post Quest)',
      'the leviathan (leviathan quest)': 'The Leviathan (Quest)',
      'kalphite queen (queen airborne)': 'Kalphite Queen (Airborne)',
      'kalphite queen (queen crawling)': 'Kalphite Queen (Crawling)',
      'abyssal sire (sire phase 1)': 'Abyssal Sire (Phase 1)',
      'abyssal sire (sire phase 2)': 'Abyssal Sire (Phase 2)',
      'abyssal sire (sire phase 3 stage 1)': 'Abyssal Sire (Phase 3 Stage 1)',
      'abyssal sire (sire phase 3 stage 2)': 'Abyssal Sire (Phase 3 Stage 2)',
      'alchemical hydra (hydra electric)': 'Alchemical Hydra (Electric)',
      'alchemical hydra (hydra extinguished)': 'Alchemical Hydra (Extinguished)',
      'alchemical hydra (hydra fire)': 'Alchemical Hydra (Fire)',
      'alchemical hydra (hydra serpentine)': 'Alchemical Hydra (Serpentine)',
      'araxxor (in combat)': 'Araxxor',
      'calvarion (normal)': 'Calvar\'ion',
      'calvarion (enraged)': 'Calvar\'ion (Enraged)',
      'chaos elemental (elemental)': 'Chaos Elemental',
      'chaos fanatic (fanatic)': 'Chaos Fanatic',
      'commander zilyana (zilyana)': 'Commander Zilyana',
      'corporeal beast (beast)': 'Corporeal Beast',
      'crazy archaeologist (archaeologist)': 'Crazy Archaeologist',
      'deranged archaeologist (archaeologist)': 'Deranged Archaeologist',
      'general graardor (graardor)': 'General Graardor',
      'giant mole (mole)': 'Giant Mole',
      'king black dragon (black dragon)': 'King Black Dragon',
      'kraken (kraken)': 'Kraken',
      'kril tsutsaroth (tsutsaroth)':'Kril Tsutsaroth',
      'phantom muspah (muspah melee)': 'Phantom Muspah (Melee)',
      'phantom muspah (muspah post shield)': 'Phantom Muspah (Post Shield)',
      'phantom muspah (muspah ranged)': 'Phantom Muspah (Ranged)',
      'phantom muspah (muspah shielded)': 'Phantom Muspah (Shielded)',
      'phantom muspah (muspah teleporting)': 'Phantom Muspah (Teleporting)',
      'the hueycoatl (hueycoatl normal head)': 'The Hueycoatl',
      'the hueycoatl (hueycoatl normal body)': 'The Hueycoatl (Body)',
      'the hueycoatl (hueycoatl normal tail)': 'The Hueycoatl (Tail)',
      'the mimic (mimic)': 'The Mimic',
      'the nightmare (nightmare)': 'The Nightmare',
      'thermonuclear smoke devil (smoke devil)': 'Thermonuclear Smoke Devil',
      'the whisperer (whisperer awakened)': 'The Whisperer (Awakened)',
      'the whisperer (whisperer post quest)': 'The Whisperer (Post Quest)',
      'the whisperer (whisperer quest)': 'The Whisperer (Quest)',
      'vetion (normal)': 'Vet\'ion',
      'vetion (enraged)': 'Vet\'ion (Enraged)',
      'vorkath (dragon slayer ii)': 'Vorkath (Dragon Slayer 2)'
      // Add more cleanup cases here as needed
    };

    const cleaned = replacements[rawName.toLowerCase()] || rawName;

    // Capitalize first letter of each word
    return cleaned.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  isWeaknessObject(value: any): value is { [key: string]: string } {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  isWeaknessNone(value: any): value is 'none' {
    return value === 'none';
  }

  get isSelectedBossVenomToPoison(): boolean {
    const bossName = this.getSelectedBoss()?.name;
    const cleaned = this.getCleanBossName(bossName);
    return this.venomToPoisonBosses.has(cleaned);
  }


  getOrderedBossPhases(monster: Monster): Monster['bosses'] {
    const phaseOrderOverrides: { [key: string]: string[] } = {
      'kalphite queen': ['queen crawling', 'queen airborne'],
      'duke sucellus': ['duke sucellus (sucellus awake post quest)', 'duke sucellus (sucellus awake awakened)', 'duke sucellus (sucellus awake quest)'],
      'alchemical hydra': ['alchemical hydra (hydra serpentine)', 'alchemical hydra (hydra electric)', 'alchemical hydra (hydra fire)', 'alchemical hydra (hydra extinguished)'],
      'araxxor': ['araxxor (in combat)', 'araxxor (enraged)'],
      'calvarion': ['calvarion (normal)', 'calvarion (enraged)'],
      'phantom muspah': ['phantom muspah (muspah ranged)', 'phantom muspah (muspah melee)', 'phantom muspah (muspah teleporting)', 'phantom muspah (muspah shielded)', 'phantom muspah (muspah post shield)'],
      'the hueycoatl': ['the hueycoatl (hueycoatl normal head)', 'the hueycoatl (hueycoatl normal body)', 'the hueycoatl (hueycoatl normal tail)'],
      'vetion': ['vetion (normal)', 'vetion (enraged)'],
      'vorkath': ['vorkath (post quest)', 'vorkath (dragon slayer ii)'],
      'zulrah': ['zulrah (serpentine)', 'zulrah (magma)', 'zulrah (tanzanite)']
    };

    const name = monster.name.toLowerCase();
    const phases = monster.bosses;

    const override = phaseOrderOverrides[name];
    if (!override) return phases;

    return [...phases].sort((a, b) => {
      const idxA = override.findIndex(s => a.name.toLowerCase().includes(s));
      const idxB = override.findIndex(s => b.name.toLowerCase().includes(s));
      return idxA - idxB;
    });
  }

  getMonsterImage(monster: Monster): string {
    // Return first boss phase image if available
    const primaryPhase = this.getOrderedBossPhases(monster)[0];
    return primaryPhase?.image || monster.image;
  }

  getSafeBossImage(boss: Monster['bosses'][0] | null): string {
    return boss?.image || 'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c';
  }

  handleKeyDown(event: KeyboardEvent) {
    if (this.suggestedItems.length === 0) return;

    if (event.key === 'ArrowDown') {
      this.highlightedIndex = (this.highlightedIndex + 1) % this.suggestedItems.length;
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.highlightedIndex =
        (this.highlightedIndex - 1 + this.suggestedItems.length) % this.suggestedItems.length;
      event.preventDefault();
    } else if (event.key === 'Enter' && this.highlightedIndex >= 0) {
      const item = this.suggestedItems[this.highlightedIndex];
      this.selectSuggestedItem(item);
      return;
    }

    // Scroll selected item into view
    setTimeout(() => {
      const el = this.itemElements.get(this.highlightedIndex);
      if (el) {
        el.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }
}
