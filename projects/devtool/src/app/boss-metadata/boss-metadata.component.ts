import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-boss-metadata',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boss-metadata.component.html',
  styleUrls: ['./boss-metadata.component.css']
})
export class BossMetadataComponent {
  metadata: any = null;
  error: string | null = null;

  bossNames: string[] = [];
  expanded: Record<string, boolean> = {};

  constructor(private http: HttpClient) {}

  loadMetadata() {
    this.http.get('http://localhost:3001/api/boss-metadata')
      .subscribe({
        next: (data: any) => {
          this.metadata = data;
          this.bossNames = Object.keys(data).sort();
          this.error = null;

          // ensure expand tracking exists for each boss
          this.bossNames.forEach(name => {
            if (this.expanded[name] === undefined) {
              this.expanded[name] = false;
            }
          });
        },
        error: (err) => {
          console.error(err);
          this.error = 'ERROR: ' + (err.error?.error ?? err.message);
          this.metadata = null;
        }
      });
  }

  toggle(bossName: string) {
    this.expanded[bossName] = !this.expanded[bossName];
  }
}
