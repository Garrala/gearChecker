import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
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
  ownedGear: { [slot: string]: string[] } = {
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
  //Item filtering
  itemSearchQuery: string = ''
  suggestedItems: { name: string; image: string }[] = []
  allItems: { name: string; image: string }[] = []
  filteredGearData: { [slot: string]: { [item: string]: any } } = {};
  constructor(private gearService: GearService, private cdRef: ChangeDetectorRef) { }

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
      this.filteredGearData = { ...data };
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
    if (!this.filteredGearData[slot]) return [];

    return Object.keys(this.filteredGearData[slot])
      .filter((item) => item !== "N/A") // ✅ Remove "N/A"
      .sort(); // ✅ Alphabetize the list
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  /** Filters suggestions for autocomplete **/
  updateSuggestions() {
    const query = this.itemSearchQuery.trim().toLowerCase()

    if (!query) {
      this.suggestedItems = []
      return
    }

    this.suggestedItems = this.allItems
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 5) // Limit to 5 suggestions
  }

  /** Select an item from autocomplete **/
  selectSuggestedItem(item: { name: string; image: string }) {
    this.itemSearchQuery = item.name
    this.suggestedItems = []
    this.filterByItem()
  }

  /** ✅ Apply item filtering to the displayed gear lists **/
  filterByItem() {
    const query = this.itemSearchQuery.trim().toLowerCase();

    if (!query) {
      this.filteredGearData = { ...this.gearData }; // ✅ Reset when empty
      return;
    }

    const filteredData: { [slot: string]: { [item: string]: any } } = {};

    Object.keys(this.gearData).forEach((slot) => {
      const filteredItems = Object.keys(this.gearData[slot]).filter((item) =>
        item.toLowerCase().includes(query)
      );

      if (filteredItems.length > 0) {
        filteredData[slot] = {};
        filteredItems.forEach((item) => {
          filteredData[slot][item] = this.gearData[slot][item];
        });
      }
    });

    this.filteredGearData = filteredData;
  }

  /** ✅ Extract all items from gearData for search/autocomplete **/
  extractAllItems() {
    const itemSet = new Set<{ name: string; image: string }>();

    Object.keys(this.gearData).forEach((slot) => {
      Object.keys(this.gearData[slot]).forEach((item) => {
        itemSet.add({
          name: item,
          image: this.gearData[slot][item]?.image ||
            'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c',
        });
      });
    });

    this.filteredGearData = { ...this.gearData }; 
  }

  /** ✅ Select or Deselect All Items in a Category **/
  toggleAllGearInSlot(slot: string) {
    console.log(`🔄 Normalized slot name: ${slot}`);
    
    if (!this.filteredGearData[slot]) {
      console.warn(`⚠️ No data found for slot: ${slot}`);
      return;
    }

    // Ensure the ownedGear slot exists as an array
    if (!Array.isArray(this.ownedGear[slot])) {
      this.ownedGear[slot] = [];
    }

    const allItems = Object.keys(this.filteredGearData[slot]).filter(
      (item) => item !== "N/A"
    );

    console.log(`🔹 Items in ${slot}:`, allItems);

    if (slot === "weapons") slot = "Weapon";
    if (slot === "special_attack") slot = "Special Attack";
    if (slot === "shields") slot = "Shields";
    if (slot === "helmets") slot = "Helmets";
    if (slot === "amulets") slot = "Amulets";
    if (slot === "capes") slot = "Capes";
    if (slot === "body") slot = "Body";
    if (slot === "legs") slot = "Legs";
    if (slot === "gloves") slot = "Gloves";
    if (slot === "boots") slot = "Boots";
    if (slot === "rings") slot = "Rings";
    if (slot === "ammo") slot = "Ammo";

    // Check if all items are already selected
    const allSelected = allItems.length > 0 && allItems.every((item) => this.ownedGear[slot].includes(item));

    if (allSelected) {
      console.log(`❌ Deselecting all in ${slot}`);
      this.ownedGear[slot] = [];
    } else {
      console.log(`✅ Selecting all in ${slot}`);
      this.ownedGear[slot] = [...allItems];
    }

    console.log(`📌 Updated ownedGear[${slot}]:`, this.ownedGear[slot]);

    localStorage.setItem("ownedGear", JSON.stringify(this.ownedGear)); // ✅ Persist

    this.cdRef.detectChanges();
  }

}
