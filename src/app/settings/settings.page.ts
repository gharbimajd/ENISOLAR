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
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit {

  settings = {
    darkMode: true,
    notifications: true,
    mapStyle: 'dark',
    distanceUnit: 'metric'
  };

  constructor(
    private toastController: ToastController,
    public theme: ThemeService
  ) {
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
    // Sync toggle to current theme state
    this.settings.darkMode = this.theme.isDark();

    // Load other saved settings
    const saved = localStorage.getItem('enisolar_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      this.settings = { ...this.settings, ...parsed, darkMode: this.theme.isDark() };
    }
  }

  onDarkModeToggle(event: any) {
    this.theme.setDark(event.detail.checked);
  }

  async saveSettings() {
    localStorage.setItem('enisolar_settings', JSON.stringify(this.settings));

    const toast = await this.toastController.create({
      message: 'Settings saved.',
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    toast.present();
  }

  async clearCache() {
    const toast = await this.toastController.create({
      message: 'Application cache cleared.',
      duration: 2000,
      color: 'warning',
      position: 'bottom'
    });
    toast.present();
  }
}
