import { TestBed } from '@angular/core/testing';

import { BleClient } from './ble-client';

describe('BleClient', () => {
  let service: BleClient;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BleClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
