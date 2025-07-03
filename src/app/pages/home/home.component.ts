import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppNavbarComponent } from '../app-navbar/app-navbar.component';
import { NavbarStateService } from '../../services/navbarStateService';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AppNavbarComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  isMenuOpen = false;
  @Input() hoveredIndex: number = 0;

  features = [
    {
      title: 'Home',
      icon: './assets/misc-icons/Dragon_med_helm.png',
      description: 'Know what to wear before you\'re there',
      bg: './assets/runescapeWallpaper.jpg',
      link: '/',
      cta: ''
    },
    {
      title: 'Gear Management',
      icon: './assets/misc-icons/Worn_Equipment.png',
      description: 'Mark the weapons, armor, and gear you own. Instantly see which setups work best for your inventory.',
      bg: './assets/gearManagement.jpeg',
      link: '/gear',
      cta: 'Manage My Gear'
    },
    {
      title: 'Boss Beastiary',
      icon: './assets/misc-icons/Mr._Mordaut_chathead.png',
      description: 'Browse every boss with detailed stats, weaknesses, and gear recommendations.',
      bg: './assets/cerberus.jpeg',
      link: '/monster',
      cta: 'View Monsters'
    },
    {
      title: 'Slayer Beastiary',
      icon: './assets/misc-icons/Slayer_icon.png',
      description: 'Track Slayer tasks and monster weaknesses to maximize your combat efficiency.',
      bg: './assets/abyssalSire.jpeg',
      link: '/slayer',
      cta: 'Browse Slayer Monsters'
    },
    {
      title: 'Boss Roulette',
      icon: './assets/misc-icons/Mystery_box_detail.png',
      description: 'Can’t decide who to fight? Let the Mysterious Old Man choose for you!',
      bg: './assets/Alchemical_Hydra_art.jpg',
      link: '/roulette',
      cta: 'Try the Roulette'
    },
    {
      title: 'Skill Training',
      icon: './assets/misc-icons/Stats_icon.png',
      description: 'Use the roulette to choose your next skill training goal and stay motivated.',
      bg: './assets/skillroulette.jpg',
      link: '/skill-training-roulette',
      cta: 'Train a Skill'
    }
  ];

  constructor(public router: Router, private navbarState: NavbarStateService) {
    this.navbarState.hoveredIndex.subscribe(index => this.hoveredIndex = index);
  }

  navigate(route: string, event: MouseEvent) {
    event.preventDefault();
    this.isMenuOpen = false;
    this.router.navigate([route]);
  }

  setHovered(index: number) {
    this.hoveredIndex = index;
  }

  get current() {
    return this.features[this.hoveredIndex];
  }
}
