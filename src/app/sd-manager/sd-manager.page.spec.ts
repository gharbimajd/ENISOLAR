import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SdManagerPage } from './sd-manager.page';

describe('SdManagerPage', () => {
  let component: SdManagerPage;
  let fixture: ComponentFixture<SdManagerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SdManagerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
