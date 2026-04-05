import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
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
  private base = environment.apiUrl;

  constructor(
    private router: Router,
    private droneService: DroneService,
    private toastCtrl: ToastController
  ) {
    addIcons({ hardwareChipOutline, paperPlaneOutline, chevronForwardOutline });
  }

  ngOnInit() { this.loadDrones(); }
  ionViewWillEnter() { this.loadDrones(); }

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