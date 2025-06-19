import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { Router } from '@angular/router'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Gear Check'
  isMenuOpen = false;

  constructor(private router: Router) {}

  navigate(route: string, event: MouseEvent) {
    event.preventDefault() // Prevents default `<a>` behavior
	this.isMenuOpen = false; 
    this.router.navigate([route])
  }
}
