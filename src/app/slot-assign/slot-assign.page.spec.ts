import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlotAssignPage } from './slot-assign.page';

describe('SlotAssignPage', () => {
  let component: SlotAssignPage;
  let fixture: ComponentFixture<SlotAssignPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SlotAssignPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
