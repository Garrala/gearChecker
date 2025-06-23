import { Routes } from '@angular/router'
import { GearManagementComponent } from './pages/gear-management/gear-management.component'
import { MonsterOverviewComponent } from './pages/monster-overview/monster-overview.component'
import { BossRouletteComponent } from './pages/boss-roulette/boss-roulette.component'
import { HomeComponent } from './pages/home/home.component';
import { SlayerMonsterOverviewComponent } from './pages/slayer-monster-overview/slayer-monster-overview.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'gear', component: GearManagementComponent },
  { path: 'monster', component: MonsterOverviewComponent },
  { path: 'monster/:name', component: MonsterOverviewComponent },
  { path: 'slayer', component: SlayerMonsterOverviewComponent },
  { path: 'slayer/:name', component: SlayerMonsterOverviewComponent },
  { path: 'roulette', component: BossRouletteComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' },
]
