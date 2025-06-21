import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { GearService } from '../../services/gear.service'
import { NgFor, NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ViewChildren, ElementRef, QueryList } from '@angular/core';

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
  collapsedSections: { [key: string]: boolean } = {};
  highlightedIndex: number = -1;
  selectedSlot: string = 'Weapon';

  @ViewChildren('itemRef') itemElements!: QueryList<ElementRef>;
  constructor(private gearService: GearService, private cdRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.loadGearData()

    const savedGear = localStorage.getItem('ownedGear')
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear)
    }

    const savedCollapse = localStorage.getItem('collapsedSections');
    if (savedCollapse) this.collapsedSections = JSON.parse(savedCollapse);
  }

  loadGearData() {
    this.gearService.getGearData().subscribe((data) => {
      this.gearData = data
      this.filteredGearData = { ...data };
      this.extractAllItems();
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
    this.itemSearchQuery = item.name;
  this.suggestedItems = [];
  this.highlightedIndex = -1;

  // Find which slot this item belongs to
  for (const slot of Object.keys(this.gearData)) {
    if (this.gearData[slot][item.name]) {
      // Set the selected slot to match the category
      this.selectedSlot = this.reverseSlotKey(slot);
      break;
    }
  }

  this.filterByItem();
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
    const seen = new Set(); // For checking duplicate names
    const all: { name: string; image: string }[] = [];

    Object.keys(this.gearData).forEach((slot) => {
      Object.keys(this.gearData[slot]).forEach((item) => {
        if (!seen.has(item)) {
          seen.add(item);
          all.push({
            name: item,
            image: this.gearData[slot][item]?.image ||
              'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c',
          });
        }
      });
    });

    this.allItems = all; // ✅ THIS was missing
  }


  /** ✅ Select or Deselect All Items in a Category **/
  toggleAllGearInSlot(slot: string) {
    
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
      this.ownedGear[slot] = [];
    } else {
      this.ownedGear[slot] = [...allItems];
    }


    localStorage.setItem("ownedGear", JSON.stringify(this.ownedGear)); // ✅ Persist

    this.cdRef.detectChanges();
  }
  
  // Export owned gear as a downloadable JSON file
	exportOwnedGear() {
  // Only export the slots that are relevant (uppercased labels used in UI)
  const validSlots = [
    'Weapon',
    'Special Attack',
    'Shields',
    'Helmets',
    'Amulets',
    'Capes',
    'Body',
    'Legs',
    'Gloves',
    'Boots',
    'Rings',
    'Ammo'
  ];

  const filteredOwnedGear: { [slot: string]: string[] } = {};

  for (const slot of validSlots) {
    if (Array.isArray(this.ownedGear[slot]) && this.ownedGear[slot].length > 0) {
      filteredOwnedGear[slot] = this.ownedGear[slot];
    }
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredOwnedGear, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', 'ownedGear.json');
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}


	// Import gear from uploaded JSON
	importOwnedGear(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result as string);
      const validSlots = [
        'Weapon',
        'Special Attack',
        'Shields',
        'Helmets',
        'Amulets',
        'Capes',
        'Body',
        'Legs',
        'Gloves',
        'Boots',
        'Rings',
        'Ammo'
      ];

      const sanitized: { [slot: string]: string[] } = {};
      for (const slot of validSlots) {
        sanitized[slot] = Array.isArray(imported[slot]) ? imported[slot] : [];
      }

      this.ownedGear = sanitized;
      localStorage.setItem('ownedGear', JSON.stringify(this.ownedGear));
      this.cdRef.detectChanges();
    } catch (err) {
      alert('Error reading gear file.');
    }
  };
  reader.readAsText(file);
  }

  toggleSection(slot: string): void {
    this.collapsedSections[slot] = !this.collapsedSections[slot];
    localStorage.setItem('collapsedSections', JSON.stringify(this.collapsedSections));
  }

  collapseAllSections() {
    for (let key of this.armorSlots.concat(['Weapon', 'Special Attack'])) {
      this.collapsedSections[key] = true;
    }
  }

  expandAllSections() {
    for (let key of this.armorSlots.concat(['Weapon', 'Special Attack'])) {
      this.collapsedSections[key] = false;
    }
  }

  slotKey(slot: string): string {
    switch (slot) {
      case 'Weapon': return 'weapons';
      case 'Special Attack': return 'special_attack';
      default: return slot.toLowerCase();
    }
  }

  reverseSlotKey(key: string): string {
    switch (key) {
      case 'weapons': return 'Weapon';
      case 'special_attack': return 'Special Attack';
      default: return key.charAt(0).toUpperCase() + key.slice(1);
    }
  }

  displaySlotName(slot: string): string {
    switch (slot) {
      case 'Weapon': return 'Weapons';
      default: return slot;
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

    // Scroll to highlighted element
    setTimeout(() => {
      const el = this.itemElements.get(this.highlightedIndex);
      if (el) {
        el.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

}
