import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageProfilePage } from './manage-profile.page';

describe('ManageProfilePage', () => {
  let component: ManageProfilePage;
  let fixture: ComponentFixture<ManageProfilePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
