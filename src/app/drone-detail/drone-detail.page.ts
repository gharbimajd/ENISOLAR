import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { DroneService, Drone } from '../services/drone.service';
import { addIcons } from 'ionicons';
import {
  hardwareChipOutline, pencilOutline, checkmarkOutline,
  closeOutline, wifiOutline, calendarOutline, bluetoothOutline,
  layersOutline, addCircleOutline, rocketOutline,
  ellipseOutline, lockClosedOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-drone-detail',
  templateUrl: './drone-detail.page.html',
  styleUrls: ['./drone-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DroneDetailPage implements OnInit {
  drone: Drone | undefined;
  newName = '';
  isRenaming = false;
  showDisconnectConfirm = false;
  isLoading = false;

  // Buffer/slot data
  slots: any[] = [];

  constructor(
    private router: Router,
    private droneService: DroneService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      hardwareChipOutline, pencilOutline, checkmarkOutline,
      closeOutline, wifiOutline, calendarOutline, bluetoothOutline,
      layersOutline, addCircleOutline, rocketOutline,
      ellipseOutline, lockClosedOutline
    });
    const nav = this.router.currentNavigation();
    this.drone = nav?.extras?.state?.['drone'];
  }

  ngOnInit() {
    if (this.drone) {
      this.loadSlots();
    }
  }

  loadSlots() {
    if (!this.drone) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    this.droneService.getDroneSlots(Number(this.drone.id), userId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.slots = res.slots;
        }
      },
      error: () => {}
    });
  }

  // ── Slot computed properties ──────────────────────────
  get totalSlots(): number { return this.slots.length; }
  get usedSlots(): number { return this.slots.filter(s => s.mission_id !== null).length; }
  get emptySlots(): number { return this.slots.filter(s => s.mission_id === null).length; }
  get lockedSlots(): number { return Math.max(0, 5 - this.totalSlots); }

  get slotArray(): { used: boolean }[] {
    return this.slots.map(s => ({ used: s.mission_id !== null }));
  }

  get lockedArray(): any[] {
    return new Array(this.lockedSlots);
  }

  // ── Navigate to buffer manager ────────────────────────
  goToBufferManager() {
    this.router.navigateByUrl('/buffer-manager', {
      state: { drone: this.drone, totalSlots: this.totalSlots }
    });
  }

  // ── Rename ────────────────────────────────────────────
  startRename() {
    if (!this.drone) return;
    this.newName = this.drone.name;
    this.isRenaming = true;
    this.showDisconnectConfirm = false;
  }

  cancelRename() {
    this.isRenaming = false;
    this.newName = '';
  }

  submitRename() {
    if (!this.drone || !this.newName.trim()) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    this.droneService.renameDrone(this.drone.id, userId, this.newName.trim()).subscribe({
      next: (res) => {
        if (res.success) {
          this.drone!.name = this.newName.trim();
          this.isRenaming = false;
          this.showToast('Drone renamed', 'success');
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: () => { this.showToast('Failed to rename', 'danger'); }
    });
  }

  // ── Disconnect ────────────────────────────────────────
  startDisconnect() {
    this.showDisconnectConfirm = true;
    this.isRenaming = false;
  }

  cancelDisconnect() {
    this.showDisconnectConfirm = false;
  }

  confirmDisconnect() {
    if (!this.drone) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;

    this.droneService.unpairDrone(this.drone.id, userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          const refund = res.credits_refunded ?? 0;
          const msg = refund > 0
            ? `Drone disconnected. ${refund} credits refunded.`
            : 'Drone disconnected successfully';
          this.showToast(msg, 'success');
          this.router.navigateByUrl('/drone-manager');
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: () => { this.isLoading = false; this.showToast('Failed to disconnect', 'danger'); }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}