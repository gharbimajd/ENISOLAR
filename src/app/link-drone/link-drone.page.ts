import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { DroneService } from '../services/drone.service';
import { addIcons } from 'ionicons';
import { linkOutline, hardwareChipOutline } from 'ionicons/icons';

@Component({
  selector: 'app-link-drone',
  templateUrl: './link-drone.page.html',
  styleUrls: ['./link-drone.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LinkDronePage {
  macInput = '';
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private droneService: DroneService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({ linkOutline, hardwareChipOutline });
  }

  onMacInput(event: any) {
    // Strip everything except hex chars
    let raw = event.target.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    // Insert colons every 2 chars
    let formatted = raw.match(/.{1,2}/g)?.join(':') ?? '';
    // Cap at 17 chars (AA:BB:CC:DD:EE:FF)
    this.macInput = formatted.substring(0, 17);
    this.errorMessage = '';
  }

  get isValid(): boolean {
    return this.macInput.length === 17;
  }

  submitLink() {
    const userId = localStorage.getItem('user_id');
    if (!userId || !this.isValid || this.isSubmitting) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    this.droneService.pairDrone(this.macInput, userId).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.showToast('Drone linked successfully!', 'success');
          this.router.navigateByUrl('/drone-manager');
        } else {
          this.errorMessage = res.message;
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Network error. Please try again.';
      }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}