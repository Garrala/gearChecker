import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-stat-scraper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-scraper.component.html',
  styleUrls: ['./stat-scraper.component.css']
})
export class StatScraperComponent {
  
  loading = false;
  status = "";
  files: string[] = [];
  selectedFile: string | null = null;
  fileContent: any = null;

  constructor(private http: HttpClient) {}

  runScraper() {
    this.loading = true;
    this.status = "Running stat scraper...";

    this.http.post("http://localhost:3001/api/stat-scraper", {})
      .subscribe({
        next: () => {
          this.loading = false;
          this.status = "Scraper complete. Reloading file list...";
          this.loadFileList();
        },
        error: err => {
          this.loading = false;
          this.status = "ERROR: " + err.message;
        }
      });
  }

  loadFileList() {
    this.http.get<string[]>("http://localhost:3001/api/stat-scrape/list")
      .subscribe({
        next: (files) => {
          this.files = files;
        }
      });
  }

  loadFile(filename: string) {
    this.selectedFile = filename;

    this.http.get("http://localhost:3001/api/stat-scrape/" + filename)
      .subscribe({
        next: (json) => {
          this.fileContent = json;
        }
      });
  }

  ngOnInit() {
    this.loadFileList();
  }
}
