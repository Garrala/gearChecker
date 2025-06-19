import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { Router } from '@angular/router'
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Gear Check'
  isMenuOpen = false;

  constructor(public router: Router) {}

  navigate(route: string, event: MouseEvent) {
    event.preventDefault() // Prevents default `<a>` behavior
	  this.isMenuOpen = false; 
    this.router.navigate([route])
  }
}
