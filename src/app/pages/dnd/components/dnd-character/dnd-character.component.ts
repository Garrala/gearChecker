import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface Character {
  name: string;  // locked to account
  class: string;
  race: string;
  level: number;
  abilities: Record<AbilityKey, number>;
  hp: number;
  ac: number;
  initiative: number;
  speed: number;
  image?: string;
  skills: Record<string, number>;
  proficiencies?: string;
  languages?: string;
  gear?: string;
  otherItems?: string;
  notes?: string;
}

@Component({
  selector: 'app-dnd-character',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dnd-character.component.html',
  styleUrls: ['./dnd-character.component.css']
})
export class DndCharacterComponent {
  @Input() character!: Character;
  @Output() save = new EventEmitter<Character>();

  activeTab: string = 'Core';
  tabs: string[] = ['Core', 'Skills', 'Spells', 'Gear', 'Other Items', 'Notes'];

  abilityList: { label: string; key: AbilityKey }[] = [
    { label: 'STR', key: 'str' },
    { label: 'DEX', key: 'dex' },
    { label: 'CON', key: 'con' },
    { label: 'INT', key: 'int' },
    { label: 'WIS', key: 'wis' },
    { label: 'CHA', key: 'cha' }
  ];

  skillList: { name: string; ability: AbilityKey }[] = [
    { name: 'Athletics', ability: 'str' },
    { name: 'Acrobatics', ability: 'dex' },
    { name: 'Sleight of Hand', ability: 'dex' },
    { name: 'Stealth', ability: 'dex' },
    { name: 'Arcana', ability: 'int' },
    { name: 'History', ability: 'int' },
    { name: 'Investigation', ability: 'int' },
    { name: 'Nature', ability: 'int' },
    { name: 'Religion', ability: 'int' },
    { name: 'Animal Handling', ability: 'wis' },
    { name: 'Insight', ability: 'wis' },
    { name: 'Medicine', ability: 'wis' },
    { name: 'Perception', ability: 'wis' },
    { name: 'Survival', ability: 'wis' },
    { name: 'Deception', ability: 'cha' },
    { name: 'Intimidation', ability: 'cha' },
    { name: 'Performance', ability: 'cha' },
    { name: 'Persuasion', ability: 'cha' },
  ];

  /** Standard 5e ability modifier calculation */
  getAbilityModifier(score: number | undefined): number {
    if (score == null) return 0;
    return Math.floor((score - 10) / 2);
  }

  emitSave() {
    this.save.emit(this.character);
  }
}
