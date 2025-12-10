import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gear-scraper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gear-scraper.component.html',
  styleUrls: ['./gear-scraper.component.css']
})
export class GearScraperComponent {

  loading = false;
  status = "";
  files: string[] = [];
  selectedFile: string | null = null;
  fileContent: any = null;

  constructor(private http: HttpClient) {}

  runScraper() {
    this.loading = true;
    this.status = "Running gear scraper...";

    this.http.post("http://localhost:3001/api/gear-scraper", {})
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
    this.http.get<string[]>("http://localhost:3001/api/gear-scrape/list")
      .subscribe(files => this.files = files);
  }

  loadFile(file: string) {
    this.selectedFile = file;

    this.http.get("http://localhost:3001/api/gear-scrape/" + file)
      .subscribe(json => this.fileContent = json);
  }

  ngOnInit() {
    this.loadFileList();
  }
}
