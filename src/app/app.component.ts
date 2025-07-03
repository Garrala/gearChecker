import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { Router } from '@angular/router'
import { CommonModule } from '@angular/common';
import { AppNavbarComponent } from './pages/app-navbar/app-navbar.component';
import { NavbarStateService } from './services/navbarStateService';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AppNavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Gear Check'
  isMenuOpen = false;
  hoveredIndex = 0;

  constructor(public router: Router, private navbarState: NavbarStateService) { }

  ngOnInit() {
    this.navbarState.hoveredIndex.subscribe(index => this.hoveredIndex = index);
  }

  onHoverChange(index: number) {
    this.navbarState.hoveredIndex.next(index);
  }

  navigate(route: string, event: MouseEvent) {
    event.preventDefault() // Prevents default `<a>` behavior
	  this.isMenuOpen = false; 
    this.router.navigate([route])
  }

  noop(index: number) {
    this.hoveredIndex = index;
  }
}
