import { ChangeDetectorRef, Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MonsterService, Monster } from '../../services/monster.service'
import { NgFor, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import confetti from 'canvas-confetti'
import { GearService } from '../../services/gear.service'
import { Router } from '@angular/router';

@Component({
  selector: 'boss-roulette',
  standalone: true,
  imports: [NgFor, NgIf, CommonModule, FormsModule],
  templateUrl: './boss-roulette.component.html',
  styleUrls: ['./boss-roulette.component.css'],
})
export class BossRouletteComponent implements OnInit {
  monsters: Monster[] = []
  gearData: { [slot: string]: { [item: string]: { image: string } } } = {};
  selectedBosses: Monster[] = []
  rouletteChoices: Monster[] = []
  revealedBosses: Monster[] = []
  selectedCard: Monster | null = null
  isRoulettePhase: boolean = false
  isMonsterListLoading: boolean = true
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
  highlightedIndex: number = -1;

  @ViewChildren('itemRef') itemElements!: QueryList<ElementRef>;

  constructor(
    private monsterService: MonsterService,
    private gearService: GearService,
    private cdRef: ChangeDetectorRef,
	  private router: Router
  ) {}

  ngOnInit() {
    this.monsterService.getMonsters().subscribe((data) => {
      this.monsters = data.map((monster) => ({ ...monster, selected: false })) // ✅ Ensure selection state
      this.filteredBosses = data
      this.loadGearData();
    })
  }

  /** ✅ Toggle Boss Selection **/
  toggleBossSelection(boss: Monster) {
    boss.selected = !boss.selected // ✅ Toggle selection
    this.selectedBosses = this.monsters.filter((b) => b.selected) 
  }

  /** ✅ Start the Roulette (must have at least 2 selected) **/
  startRoulette() {
    if (this.selectedBosses.length < 2) {
      console.warn('You must select at least 2 bosses.')
      return
    }


    this.isRoulettePhase = true // ✅ Set the phase
    this.revealedBosses = []
    this.selectedCard = null

    let shuffled = [...this.selectedBosses].sort(() => 0.5 - Math.random())
    this.rouletteChoices = shuffled.slice(0, Math.min(3, shuffled.length))


    this.cdRef.detectChanges() // ✅ Force UI update
    setTimeout(() => this.cdRef.detectChanges(), 100) // ✅ Ensure update propagation
  }

  /** ✅ Reveal the selected boss + the 2 they didn't pick **/
  revealBoss(chosenBoss: Monster, index: number) {
    if (this.selectedCard) return; // Prevent multiple selections

    this.selectedCard = chosenBoss;
    this.revealedBosses = [chosenBoss]; // Start by revealing the selected card

    // Flip the first selected card instantly
    this.cdRef.detectChanges();

    // Delay flipping the remaining cards for a smooth animation
    setTimeout(() => {
      this.revealedBosses = [...this.rouletteChoices]; // Flip all cards
      this.cdRef.detectChanges();
      this.launchConfetti(); // Launch confetti after reveal
    }, 500); // Small delay to make the reveal smoother
  }


  /** ✅ Reset the roulette **/
  resetRoulette() {
    this.isRoulettePhase = false
    this.selectedCard = null
    this.revealedBosses = []
    this.rouletteChoices = []
  }

  formatBossName(name: string): string {
    return name.replace(/ /g, '_') // ✅ Convert spaces to underscores safely
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

  /** ✅ Load gear data from GearService **/
  loadGearData() {
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data;
      this.extractAllItems(); // ✅ Extract items only after loading gearData
      this.isMonsterListLoading = false;
    });
  }

  /** ✅ Extract all unique items from bosses for search/autocomplete **/
  extractAllItems() {
    const itemMap = new Map<string, { name: string; image: string }>();

    this.monsters.forEach((monster) => {
      Object.values(monster.gear_setups || {}).forEach((setup) => {
        Object.values(setup).forEach((gearSlots) => {
          gearSlots.forEach((group) => {
            const items = Array.isArray(group) ? group : [group];

            items.forEach((item) => {
              if (!itemMap.has(item)) {
                // ✅ Pull the image from gearData if available, else use a fallback
                let itemImage = 'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c';

                Object.keys(this.gearData).forEach((slot) => {
                  if (this.gearData[slot][item]?.image) {
                    itemImage = this.gearData[slot][item].image;
                  }
                });

                itemMap.set(item, {
                  name: item,
                  image: itemImage,
                });
              }
            });
          });
        });
      });
    });

    this.allItems = Array.from(itemMap.values()); // ✅ Convert Map to array to ensure uniqueness
  }

  /** ✅ Filters suggestions for autocomplete (ensures unique items) **/
  updateSuggestions() {
    const query = this.itemSearchQuery.trim().toLowerCase();

    if (!query) {
      this.suggestedItems = [];
      return;
    }

    // ✅ Use a Map to ensure unique items
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

  filteredMonsters(): Monster[] {
    let monsters = this.monsters

    // Always show selected bosses, even if filters remove them
    if (this.selectedCategories.length > 0) {
      monsters = monsters.filter(
        (monster) =>
          this.selectedCategories.includes(monster.category) || monster.selected
      )
    }

    // Filter by item if an item search is active
    const query = this.itemSearchQuery.trim().toLowerCase()
    if (query) {
      monsters = monsters.filter(
        (monster) =>
          Object.values(monster.gear_setups || {}).some((setup) =>
            Object.values(setup).some((gearSlots) =>
              gearSlots.some((group) =>
                (Array.isArray(group) ? group : [group]).some((item) =>
                  item.toLowerCase().includes(query)
                )
              )
            )
          ) || monster.selected // ✅ Keep selected bosses even if they don't match the filter
      )
    }

    return monsters
  }

  launchConfetti() {
    confetti({
      particleCount: 300, // More particles
      spread: 180, // Wider spread across the screen
      origin: { x: 0.5, y: 1.2 }, // Center it and start from bottom
      startVelocity: 50, // Faster initial explosion
      scalar: 2.5, // Large confetti pieces
      ticks: 200, // Longer lifespan for each particle
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })

    // Fire multiple bursts from different points
    confetti({
      particleCount: 150,
      spread: 160,
      origin: { x: 0.2, y: 1 }, // Left side
      startVelocity: 40,
      scalar: 2.8,
      ticks: 180,
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })

    confetti({
      particleCount: 150,
      spread: 160,
      origin: { x: 0.8, y: 1 }, // Right side
      startVelocity: 40,
      scalar: 2.8,
      ticks: 180,
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })
  }
  
  goToBeastiary(boss: Monster) {
    if (!boss.slug) {
      const fallbackSlug = boss.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      this.router.navigate(['/monster', fallbackSlug]);
    } else {
      this.router.navigate(['/monster', boss.slug]);
    }
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
      'kril tsutsaroth (tsutsaroth)': 'Kril Tsutsaroth',
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

  getMonsterImage(monster: Monster): string {
    const primaryPhase = this.getOrderedBossPhases(monster)[0];
    return primaryPhase?.image || monster.image;
  }

  handleImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = 'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c';
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
}
