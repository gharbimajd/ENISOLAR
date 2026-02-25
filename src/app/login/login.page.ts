import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { MissionService } from '../services/mission';



// Import the specific icons to fix the console errors in your 2nd screenshot
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, personAddOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private missionService: MissionService
    
  ) {
    // This registers the icons so they actually show up!
    addIcons({ mailOutline, lockClosedOutline, personAddOutline});
  }

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  submit() {
    if (this.loginForm.invalid) return;
    
    this.isLoading = true;
    this.errorMessage = '';

    this.missionService.login(this.loginForm.value).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success) {
          localStorage.setItem('user_id', res.user_id);
          
          // 👉 FIX: Drop the cursor focus before navigating away
          (document.activeElement as HTMLElement)?.blur();
          
          this.router.navigate(['/mission-select']);
        } else {
          this.errorMessage = res.message;
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Connection error. Check your server.';
      }
    });
  }
}