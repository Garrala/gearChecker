import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import confetti from 'canvas-confetti';
import { SkillService, Skill, TrainingMethod } from '../../services/skill.service';

interface ExtendedTrainingMethod extends TrainingMethod {
  disabled?: boolean;
}

type AccountType = 'members' | 'ironman' | 'ultimate' | 'f2p';

@Component({
  selector: 'skill-training-roulette',
  standalone: true,
  imports: [NgFor, NgIf, CommonModule, FormsModule],
  templateUrl: './skill-training-roulette.component.html',
  styleUrls: ['./skill-training-roulette.component.css'],
})
export class SkillTrainingRouletteComponent implements OnInit {
  skills: Skill[] = [];
  selectedSkills: Skill[] = [];
  selectedCard: Skill | null = null;
  reelQueue: Skill[][] = [[], [], []];
  reelOffsets: number[] = [0, 0, 0];
  reelTransitionActive: boolean[] = [false, false, false];
  resultReady = false;
  isSkillListLoading = true;
  isRoulettePhase = false;
  availableMethods: ExtendedTrainingMethod[] = [];
  selectedMethods: ExtendedTrainingMethod[] = [];
  hasSpunMethods = false;
  readonly selectedAccountType: AccountType = 'members';
  highlightedMethodIndex: number | null = null;
  rolling = false;
  currentLevel: number | null = null;
  showAllMethods = false;

  constructor(private http: HttpClient, private skillService: SkillService) { }

  ngOnInit(): void {
    this.skillService.getSkills().subscribe((data) => {
      this.skills = data.map(skill => ({ ...skill, selected: false }));
      this.isSkillListLoading = false;
    });
  }

  toggleSkillSelection(skill: Skill): void {
    skill.selected = !skill.selected;
    this.selectedSkills = this.skills.filter((s) => s.selected);
  }

  resetRoulette(): void {
    this.isRoulettePhase = false;
    this.selectedCard = null;
    this.selectedMethods = [];
    this.availableMethods = [];
    this.hasSpunMethods = false;
    this.currentLevel = null;
    this.resultReady = false;
  }

  startSlotMachine(): void {
    if (this.selectedSkills.length < 1) return;

    this.isRoulettePhase = true;
    this.selectedCard = null;
    this.resultReady = false;
    this.reelQueue = [[], [], []];
    this.reelOffsets = [0, 0, 0];
    this.reelTransitionActive = [false, false, false];

    const winningSkill = this.selectedSkills[Math.floor(Math.random() * this.selectedSkills.length)];
    this.selectedCard = winningSkill;
    this.onLevelInputChange();

    const visibleRows = 3;
    const minFullSpins = 3;
    const reelItemHeight = 100;
    const selectedRow = 1; // Always middle row for clarity
    const insertIndex = visibleRows * minFullSpins + selectedRow;

    for (let i = 0; i < 3; i++) {
      const filler = [];

      // Make sure we never scroll past this index
      while (filler.length < insertIndex + visibleRows) {
        filler.push(...this.selectedSkills.filter(s => s !== winningSkill).sort(() => 0.5 - Math.random()));
      }

      // Inject winning skill at the chosen visible row
      filler.splice(insertIndex, 0, winningSkill);

      this.reelQueue[i] = filler;
      this.reelOffsets[i] = 0;
      this.reelTransitionActive[i] = false;

      const delay = i * 600;
      setTimeout(() => {
        this.reelOffsets[i] = -insertIndex * reelItemHeight;
        this.reelTransitionActive[i] = true;

        if (i === 2) {
          setTimeout(() => {
            this.resultReady = true;
            this.launchConfetti();
          }, 1000);
        }
      }, delay);
    }
  }



  getReelTransform(index: number): string {
    return `translateY(${this.reelOffsets[index]}px)`;
  }


  getWikiLink(): string {
    return this.selectedCard?.wikiLinks?.[this.selectedAccountType] || '#';
  }

  onLevelInputChange(): void {
    if (!this.selectedCard) return;

    let methods = this.selectedCard.methods?.['members'] || [];

    // Sort by minLevel (default to 1 if undefined)
    methods = methods.sort((a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1));

    this.availableMethods = methods.map(method => {
      const min = method.minLevel ?? 1;
      const max = method.maxLevel ?? 99;

      const levelValid = this.currentLevel == null || (this.currentLevel >= min && this.currentLevel <= max);

      return {
        ...method,
        disabled: !levelValid,
      };
    });
  }

  toggleShowAllMethods(): void {
    if (!this.selectedCard) return;
    const methods = this.selectedCard.methods?.['members'] || [];
    this.availableMethods = methods.map(method => ({
      ...method,
      disabled: !this.showAllMethods && this.currentLevel !== null && (
        this.currentLevel < (method.minLevel ?? 1) || this.currentLevel > (method.maxLevel ?? 99)
      )
    }));
  }


  spinTrainingMethods(): void {
    if (this.rolling) return;
    const enabled = this.availableMethods.filter(m => !m.disabled);
    if (enabled.length === 0) return;

    this.rolling = true;
    this.highlightedMethodIndex = null;
    this.hasSpunMethods = false;

    const totalCycles = 2;
    const finalIndex = Math.floor(Math.random() * enabled.length);
    const totalSteps = totalCycles * enabled.length + finalIndex + 1;

    let currentStep = 0;
    const easeOutQuad = (t: number) => t * (2 - t);

    const spinStep = () => {
      const progress = currentStep / totalSteps;
      const easedDelay = 20 + easeOutQuad(progress) * 150;

      this.highlightedMethodIndex = currentStep % enabled.length;
      currentStep++;

      if (currentStep < totalSteps) {
        setTimeout(spinStep, easedDelay);
      } else {
        this.highlightedMethodIndex = finalIndex;
        this.rolling = false;
        this.hasSpunMethods = true;
        setTimeout(() => this.launchConfetti(), 400);
      }
    };

    spinStep();
  }

  isMethodHighlighted(method: TrainingMethod): boolean {
    if (this.highlightedMethodIndex === null) return false;
    const enabled = this.availableMethods.filter(m => !m.disabled);
    return method === enabled[this.highlightedMethodIndex];
  }

  launchConfetti() {
    const burst = (x: number) =>
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { x, y: 1 },
        startVelocity: 40,
        scalar: 2.5,
        ticks: 200,
        colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
      });

    burst(0.5);
    burst(0.2);
    burst(0.8);
  }
}
