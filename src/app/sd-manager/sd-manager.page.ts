import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MqttService } from '../services/Mqtt.service';
import { environment } from '../../environments/environment';
import { CapacitorHttp } from '@capacitor/core';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  hardwareChipOutline, folderOutline, addOutline,
  trashOutline, playOutline, playSkipForwardOutline,
  stopOutline, cloudUploadOutline, checkmarkCircleOutline,
  reorderThreeOutline, searchOutline, refreshOutline,
  documentOutline, listOutline, closeCircleOutline,
  chevronForwardOutline, chevronBackOutline, rocketOutline,
  timeOutline, navigateOutline, createOutline
} from 'ionicons/icons';

export interface SdMission {
  id: string;
  name: string;
  waypoint_count: number;
  estimated_time: number;
  total_distance: number;
}

export interface SdQueue {
  name: string;
  filename: string;
  missions: SdMission[];
}

type View = 'main' | 'mission_preview' | 'queue_preview' | 'queue_edit' | 'add_from_db';

@Component({
  selector: 'app-sd-manager',
  templateUrl: './sd-manager.page.html',
  styleUrls: ['./sd-manager.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SdManagerPage implements OnInit, OnDestroy {
  drone: any = null;
  private base = environment.apiUrl;

  // ── Connection ────────────────────────────────────────
  isConnected = false;

  // ── Active tab ────────────────────────────────────────
  activeTab: 'missions' | 'queues' = 'missions';

  // ── View stack (like a mini router) ──────────────────
  currentView: View = 'main';
  selectedMission: SdMission | null = null;
  selectedQueue: SdQueue | null = null;

  // ── SD Contents (live from ESP) ───────────────────────
  sdMissions: SdMission[] = [];
  sdQueues: SdQueue[] = [];
  isLoadingSd = false;

  // ── DB Missions (for adding to SD) ───────────────────
  dbMissions: any[] = [];
  filteredDbMissions: any[] = [];
  searchQuery = '';
  isLoadingDb = false;
  sendingMissionId: string | null = null;

  // ── Queue editing ─────────────────────────────────────
  editingQueue: SdQueue | null = null;
  newQueueName = '';
  isCreatingNewQueue = false;
  isSavingQueue = false;
  draggedIndex: number | null = null;

  // ── Operations in progress ────────────────────────────
  deletingMissionId: string | null = null;
  deletingQueueName: string | null = null;
  isExecuting = false;

  private subs: Subscription[] = [];

  constructor(
    private router: Router,
    private mqttService: MqttService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      hardwareChipOutline, folderOutline, addOutline,
      trashOutline, playOutline, playSkipForwardOutline,
      stopOutline, cloudUploadOutline, checkmarkCircleOutline,
      reorderThreeOutline, searchOutline, refreshOutline,
      documentOutline, listOutline, closeCircleOutline,
      chevronForwardOutline, chevronBackOutline, rocketOutline,
      timeOutline, navigateOutline, createOutline
    });

    // ── Drone persistence fix ─────────────────────────
    // Router state is lost on refresh — fall back to sessionStorage
    const nav = this.router.currentNavigation();
    const fromNav = nav?.extras?.state?.['drone'];

    if (fromNav) {
      this.drone = fromNav;
      sessionStorage.setItem('sd_drone', JSON.stringify(fromNav));
    } else {
      const cached = sessionStorage.getItem('sd_drone');
      this.drone = cached ? JSON.parse(cached) : null;
    }
  }

  ngOnInit() {
    if (!this.drone) { this.router.navigateByUrl('/send-drone'); return; }
    this.connectMqtt();
    this.loadDbMissions();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    sessionStorage.removeItem('sd_drone');
  }

  // ── MQTT ──────────────────────────────────────────────
  connectMqtt() {
    this.mqttService.connect();
    this.subs.push(
      this.mqttService.isConnected$.subscribe(connected => {
        this.isConnected = connected;
        if (connected) this.subscribeToTopics();
      })
    );
  }

  subscribeToTopics() {
    const id = this.drone.id;

    // SD list response
    this.subs.push(
      this.mqttService.subscribeTo(`drone/${id}/sd/list_response`).subscribe((data: any) => {
        this.isLoadingSd = false;
        this.sdMissions = data.missions ?? [];
        this.sdQueues   = data.queues   ?? [];
      })
    );

    // ACK for any SD write/delete operation
    this.subs.push(
      this.mqttService.subscribeTo(`drone/${id}/sd/ack`).subscribe((data: any) => {
        this.sendingMissionId  = null;
        this.deletingMissionId = null;
        this.deletingQueueName = null;
        this.isSavingQueue     = false;
        this.isExecuting       = false;

        if (data.success) {
          this.showToast(data.message || 'Done', 'success');
          this.requestSdList(); // refresh SD contents
        } else {
          this.showToast(data.message || 'Operation failed', 'danger');
        }
      })
    );

    this.requestSdList();
  }

  requestSdList() {
    if (!this.isConnected) return;
    this.isLoadingSd = true;
    this.mqttService.publish(`drone/${this.drone.id}/sd/list`, { request: true });
  }

  // ── DB Missions ───────────────────────────────────────
  loadDbMissions() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoadingDb = true;
    from(CapacitorHttp.get({
      url: `${this.base}/get_missions.php?user_id=${userId}`
    })).pipe(map((res: any) => res.data)).subscribe({
      next: (missions: any[]) => {
        this.dbMissions = missions;
        this.filteredDbMissions = missions;
        this.isLoadingDb = false;
      },
      error: () => { this.isLoadingDb = false; }
    });
  }

  filterMissions() {
    const q = this.searchQuery.toLowerCase();
    this.filteredDbMissions = this.dbMissions.filter(m =>
      m.name.toLowerCase().includes(q)
    );
  }

  isOnSd(missionId: string): boolean {
    return this.sdMissions.some(m => m.id === missionId);
  }

  // ── Send mission from DB to SD ────────────────────────
  sendMissionToSd(mission: any) {
    if (!this.isConnected) { this.showToast('Not connected to drone', 'warning'); return; }
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.sendingMissionId = mission.id;

    from(CapacitorHttp.get({
      url: `${this.base}/get_missions.php?user_id=${userId}&mission_id=${mission.id}`
    })).pipe(map((res: any) => res.data)).subscribe({
      next: (full: any) => {
        if (!full) { this.sendingMissionId = null; this.showToast('Mission not found', 'danger'); return; }
        this.mqttService.publish(`drone/${this.drone.id}/sd/save_mission`, {
          id:             full.id,
          mission_type:   full.missionType,
          name:           full.name,
          waypoint_count: full.waypointCount,
          estimated_time: full.estimatedTime,
          total_distance: full.totalDistance,
          flight_path:    full.flightPath
        });
        this.showToast(`Sending "${full.name}" to SD...`, 'primary');
      },
      error: () => { this.sendingMissionId = null; this.showToast('Failed to fetch from DB', 'danger'); }
    });
  }

  // ── Delete mission from SD ────────────────────────────
  deleteMissionFromSd(mission: SdMission) {
    if (!this.isConnected) { this.showToast('Not connected', 'warning'); return; }
    this.deletingMissionId = mission.id;
    this.mqttService.publish(`drone/${this.drone.id}/sd/delete_mission`, { id: mission.id });
    this.showToast(`Deleting "${mission.name}" from SD...`, 'primary');
    if (this.selectedMission?.id === mission.id) this.goBack();
  }

  // ── Execute single mission ────────────────────────────
  executeMission(mission: SdMission) {
    if (!this.isConnected) { this.showToast('Not connected', 'warning'); return; }
    this.isExecuting = true;
    this.mqttService.publish(`drone/${this.drone.id}/sd/execute_mission`, { id: mission.id });
    this.showToast(`Executing "${mission.name}"...`, 'success');
  }

  // ── Execute queue ─────────────────────────────────────
  executeQueue(queue: SdQueue) {
    if (!this.isConnected) { this.showToast('Not connected', 'warning'); return; }
    this.isExecuting = true;
    this.mqttService.publish(`drone/${this.drone.id}/sd/execute_queue`, { filename: queue.filename });
    this.showToast(`Executing queue "${queue.name}"...`, 'success');
  }

  stopExecution() {
    this.mqttService.publish(`drone/${this.drone.id}/sd/execute_mission`, { command: 'STOP' });
    this.isExecuting = false;
    this.showToast('Stop command sent', 'warning');
  }

  // ── Queue management ──────────────────────────────────
  startCreateQueue() {
    this.isCreatingNewQueue = true;
    this.newQueueName = '';
    this.editingQueue = { name: '', filename: '', missions: [] };
    this.currentView = 'queue_edit';
  }

  openQueueEdit(queue: SdQueue) {
    this.editingQueue = JSON.parse(JSON.stringify(queue)); // deep copy
    this.newQueueName = queue.name;
    this.isCreatingNewQueue = false;
    this.currentView = 'queue_edit';
  }

  addMissionToQueue(mission: SdMission) {
    if (!this.editingQueue) return;
    if (this.editingQueue.missions.some(m => m.id === mission.id)) {
      this.showToast('Already in queue', 'warning'); return;
    }
    this.editingQueue.missions = [...this.editingQueue.missions, mission];
  }

  removeMissionFromQueue(index: number) {
    if (!this.editingQueue) return;
    this.editingQueue.missions.splice(index, 1);
    this.editingQueue.missions = [...this.editingQueue.missions];
  }

  // Drag & drop queue reorder
  onDragStart(index: number) { this.draggedIndex = index; }
  onDragOver(event: DragEvent, index: number) { event.preventDefault(); }
  onDrop(index: number) {
    if (this.draggedIndex === null || !this.editingQueue) return;
    const missions = [...this.editingQueue.missions];
    const dragged = missions.splice(this.draggedIndex, 1)[0];
    missions.splice(index, 0, dragged);
    this.editingQueue.missions = missions;
    this.draggedIndex = null;
  }
  onDragEnd() { this.draggedIndex = null; }

  saveQueue() {
    if (!this.isConnected) { this.showToast('Not connected', 'warning'); return; }
    if (!this.newQueueName.trim()) { this.showToast('Enter a queue name', 'warning'); return; }
    if (!this.editingQueue || this.editingQueue.missions.length === 0) {
      this.showToast('Add at least one mission', 'warning'); return;
    }

    this.isSavingQueue = true;
    const filename = this.newQueueName.trim().replace(/\s+/g, '_').toLowerCase() + '.json';

    this.mqttService.publish(`drone/${this.drone.id}/sd/save_queue`, {
      name:     this.newQueueName.trim(),
      filename: filename,
      missions: this.editingQueue.missions.map(m => ({
        id:   m.id,
        name: m.name
      }))
    });

    this.showToast(`Saving queue "${this.newQueueName}"...`, 'primary');
  }

  deleteQueue(queue: SdQueue) {
    if (!this.isConnected) { this.showToast('Not connected', 'warning'); return; }
    this.deletingQueueName = queue.name;
    this.mqttService.publish(`drone/${this.drone.id}/sd/delete_queue`, { filename: queue.filename });
    this.showToast(`Deleting queue "${queue.name}"...`, 'primary');
    if (this.currentView === 'queue_preview') this.goBack();
  }

  // ── Cockpit shortcut ──────────────────────────────────
  openCockpit() {
    this.router.navigateByUrl('/cockpit', {
      state: { drone: this.drone }
    });
  }

  // ── View navigation ───────────────────────────────────
  openMissionPreview(mission: SdMission) {
    this.selectedMission = mission;
    this.currentView = 'mission_preview';
  }

  openQueuePreview(queue: SdQueue) {
    this.selectedQueue = queue;
    this.currentView = 'queue_preview';
  }

  openAddFromDb() {
    this.searchQuery = '';
    this.filteredDbMissions = [...this.dbMissions];
    this.currentView = 'add_from_db';
  }

  goBack() {
    if (this.currentView === 'queue_edit') {
      this.editingQueue = null;
      this.newQueueName = '';
    }
    this.currentView = 'main';
    this.selectedMission = null;
    this.selectedQueue = null;
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

  isMissionInQueue(missionId: string): boolean {
    if (!this.editingQueue) return false;
    return this.editingQueue.missions.some(m => m.id === missionId);
  }
}