import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
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

  constructor(
    private monsterService: MonsterService,
    private gearService: GearService,
    private cdRef: ChangeDetectorRef,
	private router: Router
  ) {}

  ngOnInit() {
    this.monsterService.getMonsters().subscribe((data) => {
      this.isMonsterListLoading = true
      this.monsters = data.map((monster) => ({ ...monster, selected: false })) // ✅ Ensure selection state
      this.filteredBosses = data
      this.loadGearData();
      this.isMonsterListLoading = false
    })
  }

  /** ✅ Toggle Boss Selection **/
  toggleBossSelection(boss: Monster) {
    boss.selected = !boss.selected // ✅ Toggle selection
    this.selectedBosses = this.monsters.filter((b) => b.selected) // ✅ Update selected list
    console.log('Selected Bosses:', this.selectedBosses)
  }

  /** ✅ Start the Roulette (must have at least 2 selected) **/
  startRoulette() {
    if (this.selectedBosses.length < 2) {
      console.warn('You must select at least 2 bosses.')
      return
    }

    console.log('Starting Roulette with Selected Bosses:', this.selectedBosses)

    this.isRoulettePhase = true // ✅ Set the phase
    this.revealedBosses = []
    this.selectedCard = null

    let shuffled = [...this.selectedBosses].sort(() => 0.5 - Math.random())
    this.rouletteChoices = shuffled.slice(0, Math.min(3, shuffled.length))

    console.log('Shuffled deck', shuffled)
    console.log('Roulette choices', this.rouletteChoices)
    console.log('Roulette Phase', this.isRoulettePhase)

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
    console.log(
      'Filtered Monsters Called. Roulette Phase:',
      this.isRoulettePhase
    )

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

}
