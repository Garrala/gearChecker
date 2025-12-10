import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GearAuditService } from './gear-audit.service';
import { ManualFixEditorComponent } from './manual-fix-editor/manual-fix-editor.component';
import { AuditListComponent } from './audit-list/audit-list.component';

@Component({
  selector: 'app-gear-audit',
  standalone: true,
  imports: [CommonModule, ManualFixEditorComponent, AuditListComponent],
  templateUrl: './gear-audit.component.html',
  styleUrls: ['./gear-audit.component.css']
})
export class GearAuditComponent implements OnInit {

  manualFixes: any = {};
  auditList: any[] = [];

  selectedFixKey: string | null = null;

  loading = false;

  constructor(private service: GearAuditService) {}

  ngOnInit() {
    this.loadFixes();
    this.loadAudit();
  }

  loadFixes() {
    this.service.loadManualFixes().subscribe(fixes => {
      this.manualFixes = fixes || {};
    });
  }

  loadAudit() {
    this.service.loadAuditResults().subscribe(rows => {
      this.auditList = rows || [];
    });
  }

  onSelectItem(item: string) {
    if (!this.manualFixes[item]) {
      this.manualFixes[item] = {
        correct_slot: '',
        alias: ''
      };
    }
    this.selectedFixKey = item;
  }

  onSaveFixes(updated: any) {
    this.service.saveManualFixes(updated).subscribe(() => {
      this.loadFixes();
      this.loadAudit();
    });
  }

  runAudit() {
    this.loading = true;
    this.service.runFullAudit().subscribe(() => {
      this.loading = false;
      this.loadAudit();
    });
  }

  reprocess() {
    this.loading = true;
    this.service.reprocessAfterFixes().subscribe(() => {
      this.loading = false;
      this.loadAudit();
    });
  }
}
