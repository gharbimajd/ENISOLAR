import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { DroneService, Drone } from '../services/drone.service';
import { addIcons } from 'ionicons';
import {
  addOutline, hardwareChipOutline, pencilOutline,
  unlinkOutline, checkmarkOutline, closeOutline,
  wifiOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-drone-manager',
  templateUrl: './drone-manager.page.html',
  styleUrls: ['./drone-manager.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DroneManagerPage implements OnInit {
  drones: Drone[] = [];
  isLoading = true;

  // Per-card state tracked by drone id
  renamingId: string | null = null;
  newName: string = '';
  confirmDisconnectId: string | null = null;

  constructor(
    private droneService: DroneService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({ addOutline, hardwareChipOutline, pencilOutline, unlinkOutline, checkmarkOutline, closeOutline, wifiOutline });
  }

  ngOnInit() { this.loadDrones(); }
  ionViewWillEnter() { this.loadDrones(); }

  loadDrones() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;
    this.droneService.getDrones(userId).subscribe({
      next: (drones) => { this.drones = drones; this.isLoading = false; },
      error: () => { this.showToast('Failed to load drones', 'danger'); this.isLoading = false; }
    });
  }

  goToLink() {
    this.router.navigateByUrl('/link-drone');
  }

  openDetail(drone: Drone) {
    this.router.navigateByUrl('/drone-detail', { state: { drone } });
  }

async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}