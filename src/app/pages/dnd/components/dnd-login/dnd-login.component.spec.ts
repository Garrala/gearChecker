import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DndLoginComponent } from './dnd-login.component';

describe('DndLoginComponent', () => {
  let component: DndLoginComponent;
  let fixture: ComponentFixture<DndLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DndLoginComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DndLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
