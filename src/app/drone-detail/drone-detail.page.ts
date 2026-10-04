import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DroneService, Drone } from '../services/drone.service';
import { addIcons } from 'ionicons';
import {
  hardwareChipOutline, pencilOutline, checkmarkOutline,
  closeOutline, wifiOutline, calendarOutline, bluetoothOutline,
  layersOutline, addCircleOutline, rocketOutline,
  ellipseOutline, lockClosedOutline, trashOutline,speedometerOutline
} from 'ionicons/icons';
import { environment } from 'src/environments/environment';

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

  // Slots
  slots: any[] = [];
  enrichedSlots: any[] = [];
  showSlotManager = false;
  loadingMissions = false;
  confirmingSlotIndex: number | null = null; // Renamed for clarity
  isFreeing = false;

  private apiUrl = environment.apiUrl;

  constructor(
    private router: Router,
    private droneService: DroneService,
    private toastCtrl: ToastController,
    private http: HttpClient
  ) {
    addIcons({
      hardwareChipOutline, pencilOutline, checkmarkOutline,
      closeOutline, wifiOutline, calendarOutline, bluetoothOutline,
      layersOutline, addCircleOutline, rocketOutline,
      ellipseOutline, lockClosedOutline, trashOutline,speedometerOutline
    });
    const nav = this.router.currentNavigation();
    this.drone = nav?.extras?.state?.['drone'];
  }

  ngOnInit() {
    if (this.drone) this.loadSlots();
  }

  ionViewWillEnter() {
    if (this.drone) this.loadSlots();
  }

  loadSlots() {
    if (!this.drone) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    this.droneService.getDroneSlots(Number(this.drone.id), userId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.slots = res.slots;
          if (this.showSlotManager) this.enrichSlots();
        }
      },
      error: () => {}
    });
  }

  get totalSlots(): number { return this.slots.length; }
  get usedSlots(): number { return this.slots.filter(s => s.mission_id !== null).length; }
  get emptySlots(): number { return this.slots.filter(s => s.mission_id === null).length; }
  get lockedSlots(): number { return Math.max(0, 5 - this.totalSlots); }
  get slotArray(): { used: boolean }[] { return this.slots.map(s => ({ used: s.mission_id !== null })); }
  get lockedArray(): any[] { return new Array(this.lockedSlots); }

  goToBufferManager() {
    this.router.navigateByUrl('/buffer-manager', {
      state: { drone: this.drone, totalSlots: this.totalSlots }
    });
  }

  toggleSlotManager() {
    this.showSlotManager = !this.showSlotManager;
    if (this.showSlotManager) this.enrichSlots();
    else {
      this.confirmingSlotIndex = null;
      this.enrichedSlots = [];
    }
  }

  enrichSlots() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    this.loadingMissions = true;
    this.enrichedSlots = this.slots.map(s => ({ ...s, missionName: null }));

    const occupied = this.slots.filter(s => s.mission_id !== null);
    if (occupied.length === 0) { this.loadingMissions = false; return; }

    let loaded = 0;
    occupied.forEach(slot => {
      this.http.get<any>(
        `${this.apiUrl}/get_missions.php?user_id=${userId}&mission_id=${slot.mission_id}`
      ).subscribe({
        next: (mission) => {
          const idx = this.enrichedSlots.findIndex(s => s.id === slot.id);
          if (idx !== -1) this.enrichedSlots[idx].missionName = mission.name ?? 'Unknown';
          loaded++;
          if (loaded === occupied.length) this.loadingMissions = false;
        },
        error: () => {
          loaded++;
          if (loaded === occupied.length) this.loadingMissions = false;
        }
      });
    });
  }

  // ── Free slot flow ────────────────────────────────────
  startFreeSlot(slotIndex: number) {
    this.confirmingSlotIndex = slotIndex;
  }

  cancelFreeSlot() {
    this.confirmingSlotIndex = null;
  }

  confirmFreeSlot(slotIndex: number) {
    const userId = localStorage.getItem('user_id');
    
    if (!userId || !this.drone || !this.drone.id) {
      this.showToast('Missing user or drone information', 'warning');
      return;
    }

    this.isFreeing = true;

    // slotIndex is now the exact database slot_index (e.g., 1, 2, 3...)
    this.droneService.freeSlot(this.drone.id, userId, slotIndex).subscribe({
      next: (res: any) => {
        this.isFreeing = false;
        if (res.success) {
          this.confirmingSlotIndex = null;
          this.showToast('Slot freed successfully', 'success');
          this.loadSlots(); 
        } else {
          console.error(res.debug_received);
          this.showToast(res.message || 'Failed to free slot', 'danger');
        }
      },
      error: (err) => { 
        this.isFreeing = false; 
        console.error('Server Error:', err);
        this.showToast('Failed to free slot. Check console for details.', 'danger'); 
      }
    });
  }

  // ── Rename ────────────────────────────────────────────
  startRename() {
    if (!this.drone) return;
    this.newName = this.drone.name;
    this.isRenaming = true;
    this.showDisconnectConfirm = false;
  }

  cancelRename() { this.isRenaming = false; this.newName = ''; }

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
        } else { this.showToast(res.message, 'danger'); }
      },
      error: () => { this.showToast('Failed to rename', 'danger'); }
    });
  }

  // ── Disconnect ────────────────────────────────────────
  startDisconnect() { this.showDisconnectConfirm = true; this.isRenaming = false; }
  cancelDisconnect() { this.showDisconnectConfirm = false; }

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
          const msg = refund > 0 ? `Drone disconnected. ${refund} credits refunded.` : 'Drone disconnected successfully';
          this.showToast(msg, 'success');
          this.router.navigateByUrl('/drone-manager');
        } else { this.showToast(res.message, 'danger'); }
      },
      error: () => { this.isLoading = false; this.showToast('Failed to disconnect', 'danger'); }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
  openCockpit() {
    if (!this.drone) return;
    
    this.router.navigateByUrl('/cockpit', {
      state: { drone: this.drone }
    });
  }
  openSdManager() {
  if (!this.drone) return;
  this.router.navigateByUrl('/sd-manager', {
    state: { drone: this.drone }
  });
}
  setupwifi() {
    if (!this.drone) return;
    this.router.navigateByUrl('/wifi-setup', {
      state: { drone: this.drone }
    });
    
}
openadmincockpit(){
  if (!this.drone) return;
    this.router.navigateByUrl('admin-cockpit', {
      state: { drone: this.drone }
    });
} 

}