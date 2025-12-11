import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReleaseStepService {
  private base = 'http://localhost:3001/api/pipeline';

  constructor(private http: HttpClient) { }

  getDiffSummary(): Observable<any> {
    return this.http.get(`${this.base}/diff`);
  }

  getFileDiff(file: string): Observable<any> {
    return this.http.get(`${this.base}/diff/${file}`);
  }

  approveFile(file: string): Observable<any> {
    return this.http.post(`${this.base}/approve/${file}`, {});
  }
}
