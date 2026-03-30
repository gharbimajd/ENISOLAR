import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  moonOutline, 
  earthOutline, 
  speedometerOutline, 
  notificationsOutline, 
  trashOutline,
  saveOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit {

  // Settings State
  settings = {
    darkMode: true,
    notifications: true,
    mapStyle: 'dark',
    distanceUnit: 'metric'
  };

  constructor(private toastController: ToastController) {
    addIcons({
      'moon-outline': moonOutline,
      'earth-outline': earthOutline,
      'speedometer-outline': speedometerOutline,
      'notifications-outline': notificationsOutline,
      'trash-outline': trashOutline,
      'save-outline': saveOutline
    });
  }

  ngOnInit() {
    // Here you could load saved settings from localStorage
    const saved = localStorage.getItem('enisolar_settings');
    if (saved) {
      this.settings = JSON.parse(saved);
    }
  }

  async saveSettings() {
    // Save to local storage
    localStorage.setItem('enisolar_settings', JSON.stringify(this.settings));
    
    const toast = await this.toastController.create({
      message: 'Settings saved successfully.',
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    toast.present();
  }

  async clearCache() {
    // Example: Clear map tiles or temporary flight data
    const toast = await this.toastController.create({
      message: 'Application cache cleared.',
      duration: 2000,
      color: 'warning',
      position: 'bottom'
    });
    toast.present();
  }
}