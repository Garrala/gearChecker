import { ComponentFixture, TestBed } from '@angular/core/testing'

import { GearManagementComponent } from './gear-management.component'

describe('GearManagementComponent', () => {
  let component: GearManagementComponent
  let fixture: ComponentFixture<GearManagementComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GearManagementComponent],
    }).compileComponents()

    fixture = TestBed.createComponent(GearManagementComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
