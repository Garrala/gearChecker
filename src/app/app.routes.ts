import { Routes } from '@angular/router'
import { GearManagementComponent } from './pages/gear-management/gear-management.component'
import { MonsterOverviewComponent } from './pages/monster-overview/monster-overview.component'
import { BossRouletteComponent } from './pages/boss-roulette/boss-roulette.component'
import { HomeComponent } from './pages/home/home.component';
import { SlayerMonsterOverviewComponent } from './pages/slayer-monster-overview/slayer-monster-overview.component';
import { SkillTrainingRouletteComponent } from './pages/skill-training-roulette/skill-training-roulette.component';

// D&D imports
import { DndLoginComponent } from './pages/dnd/components/dnd-login/dnd-login.component';
import { DndBoardComponent } from './pages/dnd/components/dnd-board/dnd-board.component';
import { DndCharacterComponent } from './pages/dnd/components/dnd-character/dnd-character.component';
import { DndDmComponent } from './pages/dnd/components/dnd-dm/dnd-dm.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'gear', component: GearManagementComponent },
  { path: 'monster', component: MonsterOverviewComponent },
  { path: 'monster/:name', component: MonsterOverviewComponent },
  { path: 'slayer', component: SlayerMonsterOverviewComponent },
  { path: 'slayer/:name', component: SlayerMonsterOverviewComponent },
  { path: 'roulette', component: BossRouletteComponent },
  { path: 'skill-training-roulette', component: SkillTrainingRouletteComponent },
  
    // D&D routes
  { path: 'dnd/login', component: DndLoginComponent },
  { path: 'dnd/board', component: DndBoardComponent },
  { path: 'dnd/character/:name', component: DndCharacterComponent },
  { path: 'dnd/dm', component: DndDmComponent },
  
  { path: '**', redirectTo: '', pathMatch: 'full' },
]
