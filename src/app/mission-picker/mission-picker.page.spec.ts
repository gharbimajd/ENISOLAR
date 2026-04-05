import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionPickerPage } from './mission-picker.page';

describe('MissionPickerPage', () => {
  let component: MissionPickerPage;
  let fixture: ComponentFixture<MissionPickerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MissionPickerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
