import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { DroneService } from '../services/drone.service';
import { addIcons } from 'ionicons';
import {
  saveOutline, trashOutline, reorderThreeOutline,
  rocketOutline, lockClosedOutline, ellipseOutline,
  checkmarkCircleOutline, hardwareChipOutline
} from 'ionicons/icons';
import { environment } from '../../environments/environment';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CapacitorHttp } from '@capacitor/core';

@Component({
  selector: 'app-slot-assign',
  templateUrl: './slot-assign.page.html',
  styleUrls: ['./slot-assign.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SlotAssignPage implements OnInit {
  drone: any = null;
  slots: any[] = [];         // all task rows from DB ordered by slot_index
  selectedMissions: any[] = [];
  isSaving = false;

  // working copy — each entry: { slot_index, task_id, mission: {id, name, status} | null, locked: boolean }
  slotAssignments: any[] = [];

  private base = environment.apiUrl;

  draggedIndex: number | null = null;

  constructor(
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({ saveOutline, trashOutline, reorderThreeOutline, rocketOutline, lockClosedOutline, ellipseOutline, checkmarkCircleOutline, hardwareChipOutline });
    const nav = this.router.currentNavigation();
    this.drone          = nav?.extras?.state?.['drone'];
    this.slots          = nav?.extras?.state?.['slots'] ?? [];
    this.selectedMissions = nav?.extras?.state?.['selectedMissions'] ?? [];
  }

  ngOnInit() {
    if (!this.drone) { this.router.navigateByUrl('/send-drone'); return; }
    this.buildAssignments();
  }

  buildAssignments() {
    let missionQueue = [...this.selectedMissions];

    this.slotAssignments = this.slots.map((slot: any) => {
      const hasMission = !!slot.mission_id;

      if (hasMission) {
        // Pre-filled slot — locked
        return {
          slot_index: slot.slot_index,
          task_id: slot.id,
          mission: { id: slot.mission_id, name: slot.mission_name, status: slot.mission_status },
          locked: true
        };
      } else {
        // Empty slot — assign next selected mission if available
        const mission = missionQueue.shift() ?? null;
        return {
          slot_index: slot.slot_index,
          task_id: slot.id,
          mission: mission,
          locked: false
        };
      }
    });
  }

  // ── Drag & Drop (HTML5) ───────────────────────────────
  onDragStart(index: number) {
    if (this.slotAssignments[index].locked) return;
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent, index: number) {
    if (this.slotAssignments[index].locked) return;
    event.preventDefault();
  }

  onDrop(index: number) {
    if (this.draggedIndex === null) return;
    if (this.slotAssignments[index].locked) return;
    if (this.draggedIndex === index) return;

    // Swap missions between the two empty slots
    const draggedMission = this.slotAssignments[this.draggedIndex].mission;
    this.slotAssignments[this.draggedIndex].mission = this.slotAssignments[index].mission;
    this.slotAssignments[index].mission = draggedMission;
    this.slotAssignments = [...this.slotAssignments];
    this.draggedIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
  }

  // ── Clear a slot ──────────────────────────────────────
  clearSlot(index: number) {
    if (this.slotAssignments[index].locked) return;
    this.slotAssignments[index].mission = null;
    this.slotAssignments = [...this.slotAssignments];
  }

  // ── Save ──────────────────────────────────────────────
  save() {
    const userId = localStorage.getItem('user_id');
    if (!userId || !this.drone || this.isSaving) return;
    this.isSaving = true;

    const assignments = this.slotAssignments.map(s => ({
      slot_index: s.slot_index,
      mission_id: s.mission ? s.mission.id : null
    }));

    from(CapacitorHttp.post({
      url: `${this.base}/slot_manager.php`,
      data: { action: 'save', drone_id: this.drone.id, user_id: userId, assignments },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(map((res: any) => res.data)).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res.success) {
          this.showToast('Slots saved successfully!', 'success');
          this.router.navigateByUrl('/send-drone');
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: () => { this.isSaving = false; this.showToast('Failed to save', 'danger'); }
    });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ready':   return 'ready';
      case 'pending': return 'pending';
      case 'draft':   return 'draft';
      case 'done':    return 'done';
      default:        return 'draft';
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}