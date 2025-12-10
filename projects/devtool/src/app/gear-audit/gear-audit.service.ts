import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GearAuditService {
  private base = 'http://localhost:3001/api/gear';

  constructor(private http: HttpClient) {}

  /** Load manual gear fix rules */
  loadManualFixes(): Observable<any> {
    return this.http.get(`${this.base}/manual-fixes`);
  }

  /** Save updates to manual gear fixes */
  saveManualFixes(fixes: any): Observable<any> {
    return this.http.post(`${this.base}/manual-fixes`, fixes);
  }

  /** Run FULL audit transform pipeline */
  runFullAudit(): Observable<any> {
    return this.http.post(`${this.base}/run-audit`, {});
  }

  /** Run AFTER fixes are updated */
  reprocessAfterFixes(): Observable<any> {
    return this.http.post(`${this.base}/reprocess-after-fixes`, {});
  }

  /** Load audit results JSON from staging */
  loadAuditResults(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:3001/staging/boss_gear_final/gear_audit_pass1.json');
  }
}
