import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MissionService } from '../services/mission';
import { addIcons } from 'ionicons';
import { personOutline, mailOutline, lockClosedOutline, saveOutline, alertCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-manage-profile',
  templateUrl: './manage-profile.page.html',
  styleUrls: ['./manage-profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule]
})
export class ManageProfilePage implements OnInit {
  profileForm!: FormGroup;
  isLoading = false;
  isFetchingData = true;
  userId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private missionService: MissionService,
    private toastController: ToastController,
    private router: Router
  ) {
    addIcons({ personOutline, mailOutline, lockClosedOutline, saveOutline, alertCircleOutline });
  }

ngOnInit() {
    this.userId = localStorage.getItem('user_id');

    // Add current_password to the form
    this.profileForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      current_password: [''], // NEW
      new_password: ['', [Validators.minLength(6)]], 
      confirm_password: [''] 
    }, { validators: this.passwordMatchValidator });

    this.loadCurrentProfile();
  }

  // Custom validator to ensure passwords match ONLY if they are trying to change it
  passwordMatchValidator(g: FormGroup) {
    const password = g.get('new_password')?.value;
    const confirm = g.get('confirm_password')?.value;
    if (password && password !== confirm) {
      return { mismatch: true };
    }
    return null;
  }

  loadCurrentProfile() {
    this.isFetchingData = true;
    this.missionService.getProfile().subscribe({
      next: (data: any) => {
        if (data && !data.error) {
          // Pre-fill the form with current name and email
          this.profileForm.patchValue({
            full_name: data.full_name,
            email: data.email
          });
        } else {
          this.showToast('Could not load profile data', 'danger');
        }
        this.isFetchingData = false;
      },
      error: () => {
        this.showToast('Network error while loading profile', 'danger');
        this.isFetchingData = false;
      }
    });
  }

  onSaveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    
    // Prepare data to send to PHP
    const payload = {
      user_id: this.userId,
      full_name: this.profileForm.value.full_name,
      email: this.profileForm.value.email,
      current_password: this.profileForm.value.current_password, // NEW
      new_password: this.profileForm.value.new_password
    };

    // Make sure you add `updateProfile(data: any)` to your MissionService!
    this.missionService.updateProfile(payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success) {
          this.showToast(res.message, 'success');
          // Clear password fields after successful save
          this.profileForm.patchValue({ new_password: '', confirm_password: '' });
          this.profileForm.markAsUntouched();
        } else {
          this.showToast(res.message || 'Update failed', 'danger');
        }
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Network error while updating profile', 'danger');
      }
    });
  }

  goToForgotPassword() {
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