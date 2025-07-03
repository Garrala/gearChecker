import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavbarStateService {
  hoveredIndex = new BehaviorSubject<number>(0);
}
