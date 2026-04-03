import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DroneManagerPage } from './drone-manager.page';

describe('DroneManagerPage', () => {
  let component: DroneManagerPage;
  let fixture: ComponentFixture<DroneManagerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DroneManagerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
