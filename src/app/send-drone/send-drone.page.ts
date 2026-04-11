import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router'; // <-- Added ActivatedRoute
import { DroneService, Drone } from '../services/drone.service';
import { addIcons } from 'ionicons';
import { hardwareChipOutline, paperPlaneOutline, chevronForwardOutline } from 'ionicons/icons';
import { environment } from '../../environments/environment';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CapacitorHttp } from '@capacitor/core';

@Component({
  selector: 'app-send-drone',
  templateUrl: './send-drone.page.html',
  styleUrls: ['./send-drone.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SendDronePage implements OnInit {
  drones: Drone[] = [];
  isLoading = true;
  loadingDroneId: string | null = null;
  mode: 'http' | 'sd' = 'http'; // <-- Variable to store where we came from
  private base = environment.apiUrl;

  constructor(
    private router: Router,
    private route: ActivatedRoute, // <-- Inject ActivatedRoute
    private droneService: DroneService,
    private toastCtrl: ToastController
  ) {
    addIcons({ hardwareChipOutline, paperPlaneOutline, chevronForwardOutline });
  }

ngOnInit() { 
    // Remove the queryParams subscription from here!
    this.loadDrones(); 
  }

  ionViewWillEnter() { 
    // 1. Read the mode every time the view enters using snapshot
    const currentMode = this.route.snapshot.queryParams['mode'];
    
    if (currentMode === 'sd') {
      this.mode = 'sd';
    } else {
      this.mode = 'http';
    }

    console.log("Entered Send-Drone Page. Mode is set to:", this.mode); // <-- This will help us debug

    // 2. Load drones
    this.loadDrones(); 
  }

  loadDrones() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;
    this.droneService.getDrones(userId).subscribe({
      next: (drones) => { this.drones = drones; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  selectDrone(drone: Drone) {
    console.log("Clicked drone. Current mode is:", this.mode);
    // === IF WE CAME FROM SD MANAGER ===
    if (this.mode === 'sd') {
      this.router.navigateByUrl('/sd-manager', {
        state: { drone: drone }
      });
      return;
    }

    // === IF WE CAME FROM SEND MISSION (HTTP) ===
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.loadingDroneId = drone.id;

    // Load slots first so mission-picker knows how many empty slots exist
    from(CapacitorHttp.post({
      url: `${this.base}/slot_manager.php`,
      data: { action: 'load', drone_id: drone.id, user_id: userId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(map((res: any) => res.data)).subscribe({
      next: (res: any) => {
        this.loadingDroneId = null;
        if (res.success) {
          this.router.navigateByUrl('/mission-picker', {
            state: { drone, slots: res.slots }
          });
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: () => { this.loadingDroneId = null; this.showToast('Failed to load slots', 'danger'); }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    toast.present();
  }
}