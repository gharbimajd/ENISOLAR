import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapPlannerPage } from './map-planner.page';

describe('MapPlannerPage', () => {
  let component: MapPlannerPage;
  let fixture: ComponentFixture<MapPlannerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MapPlannerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
