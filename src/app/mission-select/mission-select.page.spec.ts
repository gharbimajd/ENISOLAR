import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionSelectPage } from './mission-select.page';

describe('MissionSelectPage', () => {
  let component: MissionSelectPage;
  let fixture: ComponentFixture<MissionSelectPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MissionSelectPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
