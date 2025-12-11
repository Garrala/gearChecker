import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { BossMetadataComponent } from '../boss-metadata/boss-metadata.component';
import { HtmlDownloaderComponent } from '../html-downloader/html-downloader.component';
import { StatScraperComponent } from '../stat-scraper/stat-scraper.component';
import { GearScraperComponent } from '../gear-scraper/gear-scraper.component';
import { GearAuditComponent } from '../gear-audit/gear-audit.component';
import { MergeStepComponent } from '../merge-step/merge-step.component';
import { ReleaseStepComponent } from '../release-step/release-step.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    BossMetadataComponent,
    HtmlDownloaderComponent,
    StatScraperComponent,
    GearScraperComponent,
    GearAuditComponent,
    MergeStepComponent,
    ReleaseStepComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {

  steps = [
    { id: 'boss-metadata', label: 'Step 1: Boss metadata' },
    { id: 'raw-html', label: 'Step 2: Raw HTML scrape' },
    { id: 'stat-scraper', label: 'Step 3: Stat scraper' },
    { id: 'gear-scraper', label: 'Step 4: Gear Scraper' },
    { id: 'gear-audit', label: 'Step 5: Gear Audit & Fixes' },
    { id: 'merge-step', label: 'Step 6: Merge Data' },
    { id: 'release-step', label: 'Step 7: Compare & Release' },
    { id: 'cleanup', label: 'Step 8: Cleanup Staging' }
  ];

  activeStep: string = 'boss-metadata';

  cleanupLoading = false;
  cleanupResult: string = '';

  constructor(private http: HttpClient) { }

  selectStep(stepId: string) {
    this.activeStep = stepId;
  }

  runCleanup() {
    this.cleanupLoading = true;
    this.cleanupResult = '';

    this.http.post('http://localhost:3001/api/pipeline/cleanup', {})
      .subscribe({
        next: (res) => {
          this.cleanupLoading = false;
          this.cleanupResult = JSON.stringify(res, null, 2);
        },
        error: (err) => {
          this.cleanupLoading = false;
          this.cleanupResult = 'ERROR:\n' + JSON.stringify(err, null, 2);
        }
      });
  }
}
