import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { MissionService } from '../services/mission';
import { addIcons } from 'ionicons';
import { personOutline, mailOutline, lockClosedOutline, arrowBackOutline, alertCircleOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID  = 'service_0xiw0j4';
const EMAILJS_TEMPLATE_ID = 'template_1zyassf';
const EMAILJS_PUBLIC_KEY  = 'jOANEdfFTmhoLiAgy';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  otpForm!: FormGroup;

  currentStep: 'register' | 'otp' = 'register';

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  maskedEmail = '';

  // Store OTP generated on frontend to verify locally
  private generatedOtp = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private missionService: MissionService
  ) {
    addIcons({ personOutline, mailOutline, lockClosedOutline, arrowBackOutline, alertCircleOutline, shieldCheckmarkOutline });
  }

  ngOnInit() {
    const gmailPattern = /^[a-z0-9](\.?[a-z0-9]){4,}@gmail\.com$/;

    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(gmailPattern)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // CHECK MEMORY: If returning from Gmail, restore the screen
    this.restoreState();
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirm = g.get('confirm_password')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const visible = local.substring(0, 2);
    return `${visible}${'*'.repeat(local.length - 2)}@${domain}`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // --- LOCAL STORAGE HELPERS ---
  private saveState() {
    localStorage.setItem('reg_step', 'otp');
    localStorage.setItem('reg_otp', this.generatedOtp);
    localStorage.setItem('reg_masked', this.maskedEmail);
    // Save form data so we don't lose the email/password for the backend
    localStorage.setItem('reg_form', JSON.stringify(this.registerForm.value));
    
    // Set a 10-minute expiration timestamp
    const expiryTime = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('reg_expiry', expiryTime.toString());
  }

  private restoreState() {
    const savedStep = localStorage.getItem('reg_step');
    const expiry = localStorage.getItem('reg_expiry');

    // If step is OTP and 10 minutes haven't passed
    if (savedStep === 'otp' && expiry && Date.now() < parseInt(expiry, 10)) {
      this.currentStep = 'otp';
      this.generatedOtp = localStorage.getItem('reg_otp') || '';
      this.maskedEmail = localStorage.getItem('reg_masked') || '';
      
      const savedForm = localStorage.getItem('reg_form');
      if (savedForm) {
        this.registerForm.patchValue(JSON.parse(savedForm));
      }
    } else if (savedStep === 'otp') {
      // It expired while they were away
      this.clearState();
      this.errorMessage = 'Session expired. Please register again.';
    }
  }

  private clearState() {
    localStorage.removeItem('reg_step');
    localStorage.removeItem('reg_otp');
    localStorage.removeItem('reg_masked');
    localStorage.removeItem('reg_form');
    localStorage.removeItem('reg_expiry');
  }
  // -----------------------------

  async onRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.missionService.verifyEmail(this.registerForm.value).subscribe({
      next: async (res: any) => {
        if (!res.success) {
          this.isLoading = false;
          this.errorMessage = res.message || 'Verification failed.';
          return;
        }

        this.generatedOtp = this.generateOtp();

        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_email: this.registerForm.value.email,
              to_name:  this.registerForm.value.full_name,
              otp:      this.generatedOtp
            },
            EMAILJS_PUBLIC_KEY
          );

          this.isLoading = false;
          this.maskedEmail = this.maskEmail(this.registerForm.value.email);
          this.currentStep = 'otp';
          
          // SAVE TO MEMORY right before the user leaves the app to check email
          this.saveState();

        } catch (emailErr) {
          this.isLoading = false;
          this.errorMessage = 'Failed to send verification email. Please try again.';
          console.error('EmailJS error:', emailErr);
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Network error. Is the server online?';
      }
    });
  }

  async onConfirmOtp() {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    if (this.otpForm.value.otp !== this.generatedOtp) {
      this.errorMessage = 'Invalid code. Please try again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      email:     this.registerForm.value.email,
      full_name: this.registerForm.value.full_name,
      password:  this.registerForm.value.password
    };

    this.missionService.confirmOtp(payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success) {
          this.clearState(); // Wipe memory after success
          this.router.navigate(['/login']);
        } else {
          this.errorMessage = res.message || 'Registration failed.';
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Network error. Is the server online?';
      }
    });
  }

  goBack() {
    this.currentStep = 'register';
    this.errorMessage = '';
    this.generatedOtp = '';
    this.otpForm.reset();
    this.clearState(); // Wipe memory if they explicitly go back
  }
}