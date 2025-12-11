import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseStepService } from './release-step.service';

import * as Diff from 'diff';


@Component({
  selector: 'app-release-step',
  standalone: true,
  encapsulation: ViewEncapsulation.None,   
  imports: [CommonModule],
  templateUrl: './release-step.component.html',
  styleUrls: ['./release-step.component.css']
})
export class ReleaseStepComponent implements OnInit {

  diffSummary: any = null;
  selectedFile: string | null = null;

  diffHtml: string = '';
  approving = false;
  loadingDetails = false;

  constructor(private releaseService: ReleaseStepService) { }

  ngOnInit() {
    this.refreshSummary();
  }

  refreshSummary() {
    this.releaseService.getDiffSummary().subscribe(summary => {
      this.diffSummary = summary;
    });
  }

  selectFile(file: string) {
    this.selectedFile = file;
    this.loadDetails(file);
  }

  loadDetails(file: string) {
    this.loadingDetails = true;

    this.releaseService.getFileDiff(file).subscribe({
      next: (resp) => {
        const oldStr = JSON.stringify(resp.old ?? {}, null, 2);
        const newStr = JSON.stringify(resp.new ?? {}, null, 2);

        const diff = Diff.diffLines(oldStr, newStr);

        this.diffHtml = this.renderSideBySide(diff);

        this.loadingDetails = false;
      },
      error: () => this.loadingDetails = false
    });
  }

  renderSideBySide(diff: Diff.Change[]): string {
    let leftHtml = '';
    let rightHtml = '';

    diff.forEach(part => {
      const escaped = part.value.replace(/</g, '&lt;').replace(/>/g, '&gt;');

      if (part.added) {
        leftHtml += `<pre class="empty"></pre>`;
        rightHtml += `<pre class="added">${escaped}</pre>`;
      }
      else if (part.removed) {
        leftHtml += `<pre class="removed">${escaped}</pre>`;
        rightHtml += `<pre class="empty"></pre>`;
      }
      else {
        // unchanged
        leftHtml += `<pre>${escaped}</pre>`;
        rightHtml += `<pre>${escaped}</pre>`;
      }
    });

    return `
    <div class="side-by-side">
      <div class="column left">${leftHtml}</div>
      <div class="column right">${rightHtml}</div>
    </div>
  `;
  }


  approve() {
    if (!this.selectedFile) return;

    this.approving = true;

    this.releaseService.approveFile(this.selectedFile).subscribe({
      next: () => {
        const done = this.selectedFile;

        // Clear diff panel
        this.selectedFile = null;
        this.diffHtml = '';

        // Refresh summary to update added/changed/removed lists
        this.refreshSummary();

        console.log("Approved:", done);

        this.approving = false;
      },
      error: () => {
        this.approving = false;
      }
    });
  }

}
