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
  rouletteChoices: Skill[] = [];
  revealedSkills: Skill[] = [];
  selectedCard: Skill | null = null;
  carouselQueue: Skill[] = [];
  isSpinning = false;
  availableMethods: ExtendedTrainingMethod[] = [];
  selectedMethods: ExtendedTrainingMethod[] = [];
  hasSpunSkill: boolean = false;
  hasSpunMethods: boolean = false;
  accountTypes: AccountType[] = ['members', 'ironman', 'ultimate', 'f2p'];
  selectedAccountType: AccountType = 'members';
  highlightedMethodIndex: number | null = null;
  rolling: boolean = false;
  
  isSkillListLoading = true;
  isRoulettePhase = false;

  constructor(private http: HttpClient, private skillService: SkillService) {}
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

  revealSkill(skill: Skill): void {
    if (this.selectedCard) return;

    this.selectedCard = skill;
    this.revealedSkills = [skill];
    this.selectedMethods = this.randomizeMethods(skill);

    setTimeout(() => {
      this.revealedSkills = [...this.rouletteChoices];
      
    }, 500);
  }

  
  randomizeMethods(skill: Skill, count: number = 3): TrainingMethod[] {
    const methodsForType = skill.methods?.[this.selectedAccountType] || [];
    const shuffled = [...methodsForType].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }


    resetRoulette(): void {
	  this.isRoulettePhase = false;
	  this.selectedCard = null;
	  this.selectedMethods = [];
	  this.availableMethods = [];
	  this.carouselQueue = [];
	  this.hasSpunSkill = false;
	  this.hasSpunMethods = false;
	}
  
	spinTrainingMethods(): void {
	  if (this.rolling) return;
	  const enabled = this.availableMethods.filter((m) => !m.disabled);
	  if (enabled.length === 0) return;

	  this.rolling = true;
	  this.highlightedMethodIndex = null;
	  this.hasSpunMethods = false;

	  const totalCycles = 2;
	  const finalIndex = Math.floor(Math.random() * enabled.length);
	  const totalSteps = totalCycles * enabled.length + finalIndex + 1;

	  let currentStep = 0;

	  // Updated easing curve (faster start)
	  const easeOutQuad = (t: number) => t * (2 - t);

	  const spinStep = () => {
		const progress = currentStep / totalSteps;

		// 🔧 Lower base delay + smaller range = faster spin
		const easedDelay = 20 + easeOutQuad(progress) * 150;

		this.highlightedMethodIndex = currentStep % enabled.length;
		currentStep++;

		if (currentStep < totalSteps) {
		  setTimeout(spinStep, easedDelay);
		} else {
		  this.highlightedMethodIndex = finalIndex;
		  this.rolling = false;
		  this.hasSpunMethods = true;
		   setTimeout(() => {
			this.launchConfetti();
		  }, 400);
		}
	  };

	  spinStep();
	}





	isMethodHighlighted(method: TrainingMethod): boolean {
	  if (this.highlightedMethodIndex === null) return false;
	  const enabled = this.availableMethods.filter(m => !m.disabled);
	  return method === enabled[this.highlightedMethodIndex];
	}


  startRoulette(): void {
  if (this.selectedSkills.length < 1) return;

  this.isRoulettePhase = true;
  this.selectedCard = null;
  this.selectedMethods = [];
  this.carouselQueue = [];
  this.hasSpunSkill = false;
  this.hasSpunMethods = false;

  const spinLength = 20;
  const rollPool = [...this.selectedSkills];
  for (let i = 0; i < spinLength; i++) {
    const pick = rollPool[Math.floor(Math.random() * rollPool.length)];
    this.carouselQueue.push(pick);
  }

  this.isSpinning = true;

  setTimeout(() => {
    this.isSpinning = false;
    this.selectedCard = this.carouselQueue[this.carouselQueue.length - 1];
    const methodsForType = this.selectedCard.methods?.[this.selectedAccountType] || [];
	this.availableMethods = methodsForType.map((m) => ({
		...m,
		disabled: false,
	}));
    this.hasSpunSkill = true;
  }, 1500);
}


setAccountType(type: AccountType): void {
    this.selectedAccountType = type;
    const methodsForType = this.selectedCard?.methods?.[type] || [];
    this.availableMethods = methodsForType.map((m) => ({ ...m, disabled: false }));
    this.selectedMethods = [];
    this.hasSpunMethods = false;
  }

getWikiLink(): string {
  return this.selectedCard?.wikiLinks?.[this.selectedAccountType] || '#';
}

launchConfetti() {
    confetti({
      particleCount: 300, // More particles
      spread: 180, // Wider spread across the screen
      origin: { x: 0.5, y: 1.2 }, // Center it and start from bottom
      startVelocity: 50, // Faster initial explosion
      scalar: 2.5, // Large confetti pieces
      ticks: 200, // Longer lifespan for each particle
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })

    // Fire multiple bursts from different points
    confetti({
      particleCount: 150,
      spread: 160,
      origin: { x: 0.2, y: 1 }, // Left side
      startVelocity: 40,
      scalar: 2.8,
      ticks: 180,
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })

    confetti({
      particleCount: 150,
      spread: 160,
      origin: { x: 0.8, y: 1 }, // Right side
      startVelocity: 40,
      scalar: 2.8,
      ticks: 180,
      colors: ['#ffcc00', '#ff5733', '#33ff57', '#3383ff', '#ff33a6'],
    })
  }

}