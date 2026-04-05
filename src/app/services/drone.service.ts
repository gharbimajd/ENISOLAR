import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from '../../environments/environment';

export interface Drone {
  id: string;
  mac: string;
  name: string;
  paired_at: string;
}

@Injectable({ providedIn: 'root' })
export class DroneService {
  private base = environment.apiUrl;

  constructor() {} // HttpClient removed to fix Android security blocks

  getDrones(userId: string): Observable<Drone[]> {
    return from(CapacitorHttp.post({
      url: `${this.base}/get_drones.php`,
      data: { user_id: userId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data || [])
    );
  }

  pairDrone(mac: string, userId: string): Observable<{ success: boolean; message: string }> {
    return from(CapacitorHttp.post({
      url: `${this.base}/pair_drone.php`,
      data: { mac, user_id: userId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  unpairDrone(droneId: string, userId: string): Observable<{ success: boolean; message: string; credits_refunded?: number }> {
    return from(CapacitorHttp.post({
      url: `${this.base}/unpair_drone.php`,
      data: { drone_id: droneId, user_id: userId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  renameDrone(droneId: string, userId: string, name: string): Observable<{ success: boolean; message: string }> {
    return from(CapacitorHttp.post({
      url: `${this.base}/rename_drone.php`,
      data: { drone_id: droneId, user_id: userId, name },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  getDroneSlots(droneId: number | string, userId: string): Observable<any> {
    return from(CapacitorHttp.post({
      url: `${this.base}/get_drone_slots.php`,
      data: {
        drone_id: droneId.toString(),
        user_id: userId
      },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  getUserCredits(userId: string): Observable<any> {
    return from(CapacitorHttp.post({
      url: `${this.base}/get_user_credits.php`,
      data: { user_id: userId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  purchaseBuffer(droneId: number | string, userId: string, slotsToAdd: number): Observable<any> {
    return from(CapacitorHttp.post({
      url: `${this.base}/purchase_buffer.php`,
      data: {
        drone_id: droneId.toString(),
        user_id: userId,
        slots_to_add: slotsToAdd
      },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }
freeSlot(droneId: number | string, userId: string, slotIndex: number): Observable<any> {
  return from(CapacitorHttp.post({
    url: `${this.base}/free_slot.php`,
    data: {
      drone_id: droneId.toString(),
      user_id: userId,
      slot_index: slotIndex
    },
    headers: { 'Content-Type': 'application/json' }
  })).pipe(
    map((res: HttpResponse) => res.data)
  );
}
 
}