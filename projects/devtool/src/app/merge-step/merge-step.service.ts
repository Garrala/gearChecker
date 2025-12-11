import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MergeStepService {
  private base = 'http://localhost:3001/api/pipeline';

  constructor(private http: HttpClient) { }

  runMerge(): Observable<any> {
    return this.http.post(`${this.base}/merge`, {});
  }
}
