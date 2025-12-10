import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BossMetadataComponent } from '../boss-metadata/boss-metadata.component';
import { HtmlDownloaderComponent } from '../html-downloader/html-downloader.component';
import { StatScraperComponent } from '../stat-scraper/stat-scraper.component';
import { GearScraperComponent } from '../gear-scraper/gear-scraper.component';
import { GearAuditComponent } from '../gear-audit/gear-audit.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    BossMetadataComponent,
    HtmlDownloaderComponent,
    StatScraperComponent,
    GearScraperComponent,
    GearAuditComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {

  steps = [
    { id: 'boss-metadata', label: 'Step 1: Boss metadata' },
    { id: 'raw-html',      label: 'Step 2: Raw HTML scrape' },
    { id: 'stat-scraper',  label: 'Step 3: Stat scraper' },
    { id: 'gear-scraper',  label: 'Step 4: Gear Scraper' },
    { id: 'gear-audit',    label: 'Step 5: Gear Audit & Fixes' }

  ];

  activeStep: string = 'boss-metadata';

  output: string = '';
  error: string | null = null;

  selectStep(stepId: string) {
    this.activeStep = stepId;
  }

}
