import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminCockpitPage } from './admin-cockpit.page';

describe('AdminCockpitPage', () => {
  let component: AdminCockpitPage;
  let fixture: ComponentFixture<AdminCockpitPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminCockpitPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
