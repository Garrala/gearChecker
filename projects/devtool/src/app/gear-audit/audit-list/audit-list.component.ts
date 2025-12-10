import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'audit-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-list.component.html',
  styleUrls: ['./audit-list.component.css']
})
export class AuditListComponent {

  @Input() auditItems: any[] = [];
  @Input() existingFixes: any = {};

  @Output() selectItem = new EventEmitter<string>();

  /** Group audit rows by normalized item name */
  get grouped() {
    const map: Record<string, any[]> = {};

    this.auditItems.forEach(row => {
      if (!map[row.normalized]) map[row.normalized] = [];
      map[row.normalized].push(row);
    });

    return Object.entries(map);
  }

  hasFix(item: string) {
    return this.existingFixes[item] !== undefined;
  }

  chooseItem(item: string) {
    this.selectItem.emit(item);
  }
}
