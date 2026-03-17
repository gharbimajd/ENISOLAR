import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuxMapPlannerPage } from './aux-map-planner.page';

describe('AuxMapPlannerPage', () => {
  let component: AuxMapPlannerPage;
  let fixture: ComponentFixture<AuxMapPlannerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AuxMapPlannerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
