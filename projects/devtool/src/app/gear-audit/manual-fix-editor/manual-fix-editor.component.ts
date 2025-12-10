import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'manual-fix-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manual-fix-editor.component.html',
  styleUrls: ['./manual-fix-editor.component.css']
})
export class ManualFixEditorComponent {

  @Input() selectedKey: string | null = null;
  @Input() fixes: any = {};

  @Output() saveFixes = new EventEmitter<any>();

  /** Helper: Angular templates cannot call Array.isArray directly */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  /** Add a new alias entry when alias is an array */
  addAlias() {
    if (!this.selectedKey) return;

    const entry = this.fixes[this.selectedKey];

    if (!Array.isArray(entry.alias)) {
      entry.alias = entry.alias ? [entry.alias] : [];
    }

    entry.alias.push("");
  }

  /** Convert a single alias string → array mode */
  convertToArray() {
    if (!this.selectedKey) return;

    const entry = this.fixes[this.selectedKey];
    const single = entry.alias;

    entry.alias = single ? [single] : [];
  }

  /** Save to parent component */
  onSave() {
    this.saveFixes.emit(this.fixes);
  }

  trackByIdx(i: number) {
    return i;
  }
}
