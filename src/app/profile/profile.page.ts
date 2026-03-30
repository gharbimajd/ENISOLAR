import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { IonicModule, ToastController } from '@ionic/angular'; 
import { addIcons } from 'ionicons';
import { 
  logOutOutline, person, airplane, checkmarkCircle, 
  settingsOutline, helpCircleOutline, cameraOutline 
} from 'ionicons/icons';
import { AuthService } from '../services/auth';
// Import Capacitor Camera
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Import your service
import { MissionService } from '../services/mission'; 

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true, 
  imports: [IonicModule, CommonModule, FormsModule,] 
})
export class ProfilePage implements OnInit {
  
  userData: any = {
    full_name: 'Loading Pilot...',
    email: '',
    created_at: '',
    total_missions: 0,
    done_missions: 0,
    image: null // Will hold the Base64 from DB
  };

  isLoading = true;
  isLoadingAvatar = false;
  
  // Default fallback image
  avatarUrl: string = 'https://ionicframework.com/docs/img/demos/avatar.svg'; 

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private missionService: MissionService
  ) {
    addIcons({
      'log-out-outline': logOutOutline,
      'person': person,
      'airplane': airplane,
      'checkmark-circle': checkmarkCircle,
      'settings-outline': settingsOutline,
      'help-circle-outline': helpCircleOutline,
      'camera-outline': cameraOutline
    });
  }

  ngOnInit() {
    this.loadUserData();
  }

  loadUserData() {
    this.isLoading = true;
    this.missionService.getProfile().subscribe({
      next: (data: any) => {
        if (data && !data.error) {
          this.userData = data;
          // If the DB has an image, use it!
          if (this.userData.image) {
            this.avatarUrl = this.userData.image;
          }
        } else {
          this.showToast(data.error || 'Could not load profile', 'danger');
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.showToast('Network error while loading profile', 'danger');
        this.isLoading = false;
      }
    });
  }

  async changeAvatar() {
    try {
      // 1. Get photo as Base64 string
      const image = await Camera.getPhoto({
        quality: 70, // Reduced quality slightly for faster DB upload
        allowEditing: true, 
        resultType: CameraResultType.Base64, // CHANGED from Uri to Base64
        source: CameraSource.Photos, 
      });

      if (image.base64String) {
        this.isLoadingAvatar = true;
        
        // Format the string for display and storage
        const base64Data = `data:image/${image.format};base64,${image.base64String}`;
        
        // Show immediate preview
        this.avatarUrl = base64Data; 

        // 2. THIS IS THE MISSING LINK: Send to PHP
        this.missionService.updateAvatar({ image: base64Data }).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.showToast('Avatar saved to database.', 'success');
            } else {
              this.showToast(res.error || 'Failed to save to database.', 'warning');
            }
            this.isLoadingAvatar = false;
          },
          error: (err) => {
            console.error('Upload error', err);
            this.showToast('Network error while saving avatar.', 'danger');
            this.isLoadingAvatar = false;
          }
        });
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Camera error:', error);
        this.showToast('Failed to access photos.', 'danger');
      }
    }
  }

  // Helper methods
  navigateTo(path: string) {
    this.router.navigate([path]);
  }

 logout() {
    // This triggers the perfectly secure, history-wiping logout we just built!
    this.authService.logout();
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