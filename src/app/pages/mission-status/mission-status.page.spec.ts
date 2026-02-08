import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionStatusPage } from './mission-status.page';

describe('MissionStatusPage', () => {
  let component: MissionStatusPage;
  let fixture: ComponentFixture<MissionStatusPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MissionStatusPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
