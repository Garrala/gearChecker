import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TrainingMethod {
  name: string;
  minLevel?: number;
  maxLevel?: number;
  intensity?: 'afk' | 'low' | 'medium' | 'high';
  disabled?: boolean; 
}

export interface WikiLinks {
  members?: string;
  ironman?: string;
  ultimate?: string;
  f2p?: string;
}

export interface Skill {
  name: string;
  icon: string;
  selected?: boolean;
  wikiLinks?: WikiLinks;
  methods: {
    members?: TrainingMethod[];
    ironman?: TrainingMethod[];
    ultimate?: TrainingMethod[];
    f2p?: TrainingMethod[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class SkillService {
  private skillListUrl = 'assets/skills-data/skills.json';

  constructor(private http: HttpClient) {}

  getSkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(this.skillListUrl);
  }
}
