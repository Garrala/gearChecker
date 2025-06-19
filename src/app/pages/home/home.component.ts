import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

  isMenuOpen = false;

  constructor(public router: Router) { }

  navigate(route: string, event: MouseEvent) {
    event.preventDefault() // Prevents default `<a>` behavior
    this.isMenuOpen = false;
    this.router.navigate([route])
  }
}
