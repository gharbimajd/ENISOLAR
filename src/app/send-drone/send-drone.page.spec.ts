import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SendDronePage } from './send-drone.page';

describe('SendDronePage', () => {
  let component: SendDronePage;
  let fixture: ComponentFixture<SendDronePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SendDronePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
