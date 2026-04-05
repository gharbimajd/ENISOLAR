import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { DroneService } from '../services/drone.service';
import { addIcons } from 'ionicons';
import {
  layersOutline, addCircleOutline, cartOutline, rocketOutline,
  ellipseOutline, lockClosedOutline, removeOutline, addOutline,
  checkmarkCircleOutline, alertCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-buffer-manager',
  templateUrl: './buffer-manager.page.html',
  styleUrls: ['./buffer-manager.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class BufferManagerPage implements OnInit {
  drone: any = null;
  slots: any[] = [];
  credits = 0;
  slotsToAdd = 1;
  isPurchasing = false;

  constructor(
    private router: Router,
    private droneService: DroneService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      layersOutline, addCircleOutline, cartOutline, rocketOutline,
      ellipseOutline, lockClosedOutline, removeOutline, addOutline,
      checkmarkCircleOutline, alertCircleOutline
    });
    const nav = this.router.currentNavigation();
    this.drone = nav?.extras?.state?.['drone'];
  }

ngOnInit() {
  if (!this.drone) {
    // Safety: if arrived without nav state, go back
    this.router.navigateByUrl('/drone-manager');
    return;
  }
  this.loadData();
}
loadData(): Promise<void> {
  return new Promise((resolve) => {
    const userId = localStorage.getItem('user_id');
    if (!userId || !this.drone) { resolve(); return; }

    let done = 0;
    const check = () => { if (++done === 2) resolve(); };

    this.droneService.getDroneSlots(this.drone.id, userId).subscribe({
      next: (res: any) => { if (res.success) this.slots = res.slots; check(); },
      error: () => check()
    });

    this.droneService.getUserCredits(userId).subscribe({
      next: (res: any) => { if (res.success) this.credits = res.credits; check(); },
      error: () => check()
    });
  });
}
  // ── Slot computed ─────────────────────────────────────
  get totalSlots(): number { return this.slots.length; }

  get slotArray(): { used: boolean }[] {
    return this.slots.map(s => ({ used: s.mission_id !== null }));
  }

  get lockedArray(): any[] {
    return new Array(Math.max(0, 5 - this.totalSlots));
  }

  // ── Slot picker ───────────────────────────────────────
  incrementSlots() {
    if (this.slotsToAdd < (5 - this.totalSlots)) this.slotsToAdd++;
  }

  decrementSlots() {
    if (this.slotsToAdd > 1) this.slotsToAdd--;
  }

  // ── Purchase ──────────────────────────────────────────
purchaseSlots() {
  const userId = localStorage.getItem('user_id');
  if (!userId || !this.drone || this.isPurchasing) return;
  this.isPurchasing = true;

  this.droneService.purchaseBuffer(this.drone.id, userId, this.slotsToAdd).subscribe({
    next: (res: any) => {
      this.isPurchasing = false;
      if (res.success) {
        this.credits = res.credits_remaining;
        this.showToast(`${this.slotsToAdd} slot(s) added! ${res.credits_spent} credits spent.`, 'success');
        this.loadData().then(() => {
          // ✅ Clamp slotsToAdd after slots are refreshed
          const remaining = 5 - this.totalSlots;
          this.slotsToAdd = remaining > 0 ? 1 : 0;
        });
      } else {
        this.showToast(res.message, 'danger');
      }
    },
    error: () => { this.isPurchasing = false; this.showToast('Purchase failed', 'danger'); }
  });
}

  // ── Get credits (no functionality yet) ───────────────
  getCredits() {
    this.showToast('Credit store coming soon!', 'primary');
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}