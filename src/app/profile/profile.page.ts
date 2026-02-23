import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // Fixes the 'date' pipe error
import { FormsModule } from '@angular/forms';   // Fixes the 'ngModel' error
import { IonicModule, ToastController } from '@ionic/angular'; // Fixes all the 'ion-' element errors
import { addIcons } from 'ionicons';
import { 
  logOutOutline, personCircleOutline, mailOutline, 
  calendarOutline, lockClosedOutline, keyOutline 
} from 'ionicons/icons';

// Import your service
import { MissionService } from '../services/mission';// Adjust path if needed

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true, // Tells Angular this component handles its own imports
  imports: [IonicModule, CommonModule, FormsModule] // The magic line that fixes all your terminal errors
})
export class ProfilePage implements OnInit {
  
  userData = {
    full_name: '',
    email: '',
    created_at: ''
  };

  passwordData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  constructor(
    private router: Router,
    private toastController: ToastController,
    private missionService: MissionService
  ) {
    addIcons({
      'log-out-outline': logOutOutline,
      'person-circle-outline': personCircleOutline,
      'mail-outline': mailOutline,
      'calendar-outline': calendarOutline,
      'lock-closed-outline': lockClosedOutline,
      'key-outline': keyOutline
    });
  }

  ngOnInit() {
    this.loadUserData();
  }

  loadUserData() {
    this.missionService.getProfile().subscribe({
      next: (data) => {
        if (data && !data.error) {
          this.userData = data;
        } else {
          this.showToast(data.error || 'Could not load profile', 'danger');
        }
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.showToast('Network error while loading profile', 'danger');
      }
    });
  }

  changePassword() {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.showToast('New passwords do not match!', 'warning');
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      this.showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    const payload = {
      current_password: this.passwordData.currentPassword,
      new_password: this.passwordData.newPassword
    };

    this.missionService.changePassword(payload).subscribe({
      next: (data) => {
        if (data && data.success) {
          this.showToast('Password updated successfully!', 'success');
          // Clear form on success
          this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        } else {
          this.showToast(data.error || 'Failed to update password', 'danger');
        }
      },
      error: (err) => {
        console.error('Error changing password:', err);
        this.showToast('Network error while updating password', 'danger');
      }
    });
  }

  logout() {
    localStorage.removeItem('user_id');
    this.router.navigate(['/login']);
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2500,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}