import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageMissionsPage } from './manage-missions.page';

describe('ManageMissionsPage', () => {
  let component: ManageMissionsPage;
  let fixture: ComponentFixture<ManageMissionsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageMissionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
