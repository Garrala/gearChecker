import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-navbar.component.html',
  styleUrls: ['./app-navbar.component.css'],
})
export class AppNavbarComponent implements OnInit {
  @Input() isHome: boolean = false;
  @Input() hoveredIndex: number = 0;
  @Output() hoveredIndexChange = new EventEmitter<number>();
  isMenuOpen: boolean = false;

  currentIndex: number = 0;

  features = [
    { title: 'Home', link: '/', icon: './assets/misc-icons/Dragon_med_helm.png' },
    { title: 'Gear Management', link: '/gear', icon: './assets/misc-icons/Worn_Equipment.png' },
    { title: 'Boss Beastiary', link: '/monster', icon: './assets/misc-icons/Mr._Mordaut_chathead.png' },
    { title: 'Slayer Beastiary', link: '/slayer', icon: './assets/misc-icons/Slayer_icon.png' },
    { title: 'Boss Roulette', link: '/roulette', icon: './assets/misc-icons/Mystery_box_detail.png' },
    { title: 'Skill Training', link: '/skill-training-roulette', icon: './assets/misc-icons/Stats_icon.png' },
  ];

  constructor(public router: Router) { }

  ngOnInit() {

    this.setHighlightFromUrl(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => this.setHighlightFromUrl(event.urlAfterRedirects));

  }

  setHighlightFromUrl(url: string) {
    let bestMatchIndex = 0;
    let bestMatchLength = 0;

    this.features.forEach((f, i) => {
      if (url === f.link || url.startsWith(f.link + '/')) {
        if (f.link.length > bestMatchLength) {
          bestMatchIndex = i;
          bestMatchLength = f.link.length;
        }
      }
    });

    this.currentIndex = bestMatchIndex;
    console.log('Highlight index:', this.currentIndex, 'for route:', url);
  }

  getIndicatorStyle() {
    const percent = (100 / this.features.length) * this.hoveredIndex;
    return {
      transform: `translateX(${percent}%)`
    };
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  handleHover(index: number) {
    if (this.isHome) {
      this.hoveredIndexChange.emit(index);
    }
  }

  isActive(i: number): boolean {
    return this.isHome ? i === this.hoveredIndex : i === this.currentIndex;
  }
}
