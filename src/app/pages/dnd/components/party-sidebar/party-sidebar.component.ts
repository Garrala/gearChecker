import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-party-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './party-sidebar.component.html',
  styleUrls: ['./party-sidebar.component.css']
})
export class PartySidebarComponent {
  @Input() party: any[] = [];
}
