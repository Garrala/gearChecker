import { Component, OnInit } from '@angular/core';
import { GearService } from '../../services/gear.service';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gear-management',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './gear-management.component.html',
  styleUrls: ['./gear-management.component.css']
})
export class GearManagementComponent implements OnInit {
  gearData: { [slot: string]: { [item: string]: any } } = {};
  ownedGear: { [slot: string]: string[] } = {};
  armorSlots: string[] = ['Shields', 'Helmets', 'Amulets', 'Capes', 'Body', 'Legs', 'Gloves', 'Boots', 'Rings', 'Ammo'];
  loading: boolean = true;

  constructor(private gearService: GearService) { }

  ngOnInit() {
    this.loadGearData();

    const savedGear = localStorage.getItem("ownedGear");
    if (savedGear) {
      this.ownedGear = JSON.parse(savedGear);
    }
  }

  loadGearData() {
    this.gearService.getGearData().subscribe(data => {
      this.gearData = data;
      this.loading = false; // Hide spinner once data is loaded
    });
  }

  toggleGear(slot: string, item: string) {
    // Ensure the slot exists and is an array
    if (!Array.isArray(this.ownedGear[slot])) {
      this.ownedGear[slot] = []; // ✅ Always initialize as an array
    }

    const index = this.ownedGear[slot].indexOf(item);

    if (index > -1) {
      this.ownedGear[slot].splice(index, 1); // ✅ Remove if already selected
    } else {
      this.ownedGear[slot].push(item); // ✅ Add if not selected
    }

    localStorage.setItem("ownedGear", JSON.stringify(this.ownedGear)); // ✅ Persist
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}
