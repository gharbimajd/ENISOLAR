import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { mailOutline, arrowBackOutline, lockClosedOutline, keypadOutline, alertCircleOutline } from 'ionicons/icons';
import { MissionService } from '../services/mission'; 
import emailjs from '@emailjs/browser'; 
import { NavController } from '@ionic/angular';

const EMAILJS_SERVICE_ID  = 'service_0xiw0j4';
const EMAILJS_TEMPLATE_ID = 'template_1zyassf';
const EMAILJS_PUBLIC_KEY  = 'jOANEdfFTmhoLiAgy';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule]
})
export class ForgotPasswordPage implements OnInit {
  // Our 3 forms for the 3 steps
  emailForm!: FormGroup;
  otpForm!: FormGroup;
  resetForm!: FormGroup;
  
  // Track which screen to show
  currentStep: 'email' | 'otp' | 'reset' = 'email'; 
  
  isLoading = false;
  generatedOtp = ''; 

  constructor(private navCtrl: NavController,
    private fb: FormBuilder,
    private toastController: ToastController,
    private router: Router,
    private missionService: MissionService 
  ) {
    addIcons({ mailOutline, arrowBackOutline, lockClosedOutline, keypadOutline, alertCircleOutline });
  }

  ngOnInit() {
    const gmailPattern = /^[a-z0-9](\.?[a-z0-9]){4,}@gmail\.com$/;

    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.pattern(gmailPattern)]]
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    this.resetForm = this.fb.group({
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Check if they were already doing a reset before closing the app
    this.restoreState();
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('new_password')?.value === g.get('confirm_password')?.value
      ? null : { mismatch: true };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
goToLogin() {
  // This physically pops the current page off and slides back to login
  this.navCtrl.navigateBack('/login');
}
  // --- LOCAL STORAGE HELPERS ---
  private saveState() {
    localStorage.setItem('reset_step', this.currentStep);
    localStorage.setItem('reset_otp', this.generatedOtp);
    localStorage.setItem('reset_email', this.emailForm.value.email);
    
    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes
    localStorage.setItem('reset_expiry', expiryTime.toString());
  }

  private restoreState() {
    const savedStep = localStorage.getItem('reset_step');
    const expiry = localStorage.getItem('reset_expiry');

    if (savedStep && expiry && Date.now() < parseInt(expiry, 10)) {
      this.currentStep = savedStep as 'otp' | 'reset';
      this.generatedOtp = localStorage.getItem('reset_otp') || '';
      
      const savedEmail = localStorage.getItem('reset_email');
      if (savedEmail) {
        this.emailForm.patchValue({ email: savedEmail });
      }
    } else if (savedStep) {
      this.clearState();
      this.showToast('Session expired. Please request a new code.', 'warning');
    }
  }

  private clearState() {
    localStorage.removeItem('reset_step');
    localStorage.removeItem('reset_otp');
    localStorage.removeItem('reset_email');
    localStorage.removeItem('reset_expiry');
  }
  // -----------------------------

  // --- STEP 1: SEND OTP ---
  sendResetOtp() {
    if (this.emailForm.invalid) return;
    
    this.isLoading = true;
    const email = this.emailForm.value.email;

    this.missionService.checkEmailExists(email).subscribe({
      next: async (res: any) => {
        if (res.success) {
          this.generatedOtp = this.generateOtp();

          try {
            await emailjs.send(
              EMAILJS_SERVICE_ID,
              EMAILJS_TEMPLATE_ID,
              {
                to_email: email,
                to_name:  res.full_name || 'User',
                otp:      this.generatedOtp
              },
              EMAILJS_PUBLIC_KEY
            );

            this.isLoading = false;
            this.currentStep = 'otp'; // Move to Step 2
            this.saveState(); // Save memory!

            this.showToast('Reset code sent to your email!', 'success');

          } catch (error) {
            this.isLoading = false;
            this.showToast('Failed to send email. Please try again.', 'danger');
            console.error('EmailJS error:', error);
          }
        } else {
          this.isLoading = false;
          this.showToast(res.message, 'danger'); 
        }
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Network error checking email.', 'danger');
      }
    });
  }

  // --- STEP 2: VERIFY OTP ---
  verifyOtp() {
    if (this.otpForm.invalid) return;

    const enteredOtp = this.otpForm.value.otp;

    if (enteredOtp !== this.generatedOtp) {
      this.showToast('Invalid code. Please try again.', 'danger');
      return;
    }

    // Success! Move to step 3
    this.currentStep = 'reset';
    this.saveState(); // Update memory so if they refresh, they stay on the reset screen
  }

  // --- STEP 3: SUBMIT NEW PASSWORD ---
  submitReset() {
    if (this.resetForm.invalid) return;
    this.isLoading = true;

    const payload = {
      email: this.emailForm.value.email, // Grab email from the first step
      new_password: this.resetForm.value.new_password
    };

    this.missionService.resetPassword(payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success) {
          this.clearState(); // Wipe memory after ultimate success
          this.showToast('Password successfully reset! Please log in.', 'success');
          this.router.navigate(['/login']);
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Network error. Could not reset password.', 'danger');
      }
    });
  }

  // --- UTILS ---
  restartProcess() {
    this.currentStep = 'email';
    this.generatedOtp = '';
    this.otpForm.reset();
    this.resetForm.reset();
    this.clearState();
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}