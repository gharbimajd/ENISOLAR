import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DroneDetailPage } from './drone-detail.page';

describe('DroneDetailPage', () => {
  let component: DroneDetailPage;
  let fixture: ComponentFixture<DroneDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DroneDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
