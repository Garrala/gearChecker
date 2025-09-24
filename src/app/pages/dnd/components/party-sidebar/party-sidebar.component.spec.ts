import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartySidebarComponent } from './party-sidebar.component';

describe('PartySidebarComponent', () => {
  let component: PartySidebarComponent;
  let fixture: ComponentFixture<PartySidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartySidebarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartySidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
