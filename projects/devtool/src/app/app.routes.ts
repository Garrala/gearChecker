import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { BossMetadataComponent } from './boss-metadata/boss-metadata.component';
import { HtmlDownloaderComponent } from './html-downloader/html-downloader.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'boss-metadata', component: BossMetadataComponent },
  { path: 'download-html', component: HtmlDownloaderComponent },
];
