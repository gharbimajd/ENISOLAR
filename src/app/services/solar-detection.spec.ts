import { TestBed } from '@angular/core/testing';

import { SolarDetection } from './solar-detection';

describe('SolarDetection', () => {
  let service: SolarDetection;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SolarDetection);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
