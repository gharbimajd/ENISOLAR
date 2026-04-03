import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkDronePage } from './link-drone.page';

describe('LinkDronePage', () => {
  let component: LinkDronePage;
  let fixture: ComponentFixture<LinkDronePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LinkDronePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
