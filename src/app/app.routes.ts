import { Routes } from '@angular/router';
import { GearManagementComponent } from './pages/gear-management/gear-management.component';
import { MonsterOverviewComponent } from './pages/monster-overview/monster-overview.component';

export const routes: Routes = [
  { path: '', redirectTo: 'gear', pathMatch: 'full' },
  { path: 'gear', component: GearManagementComponent },
  { path: 'monster', component: MonsterOverviewComponent }
];
