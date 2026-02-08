import { TestBed } from '@angular/core/testing';

import { Mission } from './mission';

describe('Mission', () => {
  let service: Mission;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Mission);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
