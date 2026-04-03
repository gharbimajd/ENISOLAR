import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BufferManagerPage } from './buffer-manager.page';

describe('BufferManagerPage', () => {
  let component: BufferManagerPage;
  let fixture: ComponentFixture<BufferManagerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BufferManagerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
