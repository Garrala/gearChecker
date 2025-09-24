import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DndDmComponent } from './dnd-dm.component';

describe('DndDmComponent', () => {
  let component: DndDmComponent;
  let fixture: ComponentFixture<DndDmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DndDmComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DndDmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
