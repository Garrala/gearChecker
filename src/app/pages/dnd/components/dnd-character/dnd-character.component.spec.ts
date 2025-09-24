import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DndCharacterComponent } from './dnd-character.component';

describe('DndCharacterComponent', () => {
  let component: DndCharacterComponent;
  let fixture: ComponentFixture<DndCharacterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DndCharacterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DndCharacterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
