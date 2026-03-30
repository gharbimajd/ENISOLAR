import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular'; // <--- IMPORT NAVCONTROLLER
import { Router, RouterModule } from '@angular/router';
import { MissionService } from '../services/mission';

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
    private navCtrl: NavController, // <--- INJECT IT HERE
    private missionService: MissionService
  ) {
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
          // You already save this, which is great! The guards will use it.
          localStorage.setItem('user_id', res.user_id); 
          
          (document.activeElement as HTMLElement)?.blur();
          
          // 👉 THE MAGIC FIX: This wipes history and makes it the new "Root" page
          this.navCtrl.navigateRoot('/mission-select'); 
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

  selectMission(type: string) {
    this.router.navigate(['/map-planner'], { 
      queryParams: { mode: type } 
    });
  }
}