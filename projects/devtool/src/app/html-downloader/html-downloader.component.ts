import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-html-downloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './html-downloader.component.html',
  styleUrls: ['./html-downloader.component.css']
})
export class HtmlDownloaderComponent {
  status = '';
  loading = false;

  constructor(private http: HttpClient) {}

  startDownload() {
    this.loading = true;
    this.status = "Starting download...";

    this.http.post('http://localhost:3001/api/download-html', {})
      .subscribe({
        next: () => {
          this.loading = false;
          this.status = "HTML download has started. Check console logs.";
        },
        error: err => {
          this.loading = false;
          this.status = "ERROR: " + err.message;
        }
      });
  }
}
