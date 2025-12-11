import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MergeStepService } from './merge-step.service';

@Component({
  selector: 'app-merge-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './merge-step.component.html',
  styleUrls: ['./merge-step.component.css']
})
export class MergeStepComponent {

  isRunning = false;
  output: string | null = null;
  error: string | null = null;

  constructor(private mergeService: MergeStepService) { }

  runMerge() {
    this.isRunning = true;
    this.output = null;
    this.error = null;

    this.mergeService.runMerge().subscribe({
      next: (resp) => {
        this.output = resp.output || 'Merge complete.';
        this.isRunning = false;
      },
      error: (err) => {
        this.error = err.error || err.message;
        this.isRunning = false;
      }
    });
  }
}
