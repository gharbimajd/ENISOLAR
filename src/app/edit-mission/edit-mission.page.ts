import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, ValidationErrors } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MissionService } from '../services/mission';

@Component({
  selector: 'app-edit-mission',
  templateUrl: './edit-mission.page.html',
  styleUrls: ['./edit-mission.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule]
})
export class EditMissionPage implements OnInit {
  mission: any = null;
  allMissions: any[] = [];
  editForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private missionService: MissionService,
    private toastCtrl: ToastController
  ) {
    // Read mission passed via router state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.mission = nav.extras.state['mission'];
      this.allMissions = nav.extras.state['allMissions'] || [];
    }
  }

  ngOnInit() {
    if (!this.mission) {
      // No mission data — go back
      this.router.navigateByUrl('/manage-missions');
      return;
    }

    this.editForm = this.fb.group({
      name: [this.mission.name, [Validators.required]],
      status: [this.mission.status, [Validators.required]]
    }, { validators: this.uniqueNameValidator.bind(this) });
  }

  uniqueNameValidator(group: FormGroup): ValidationErrors | null {
    const newName = group.get('name')?.value?.trim().toLowerCase();
    if (!newName) return null;
    const isDuplicate = this.allMissions.some(m =>
      m.id !== this.mission.id && m.name.toLowerCase() === newName
    );
    return isDuplicate ? { nameExists: true } : null;
  }

  save() {
    if (this.editForm.invalid) return;

    const userId = localStorage.getItem('user_id');
    if (!userId) { this.showToast('User session not found.', 'danger'); return; }

    this.missionService.updateMission({
      user_id: userId,
      mission_id: String(this.mission.id),
      name: String(this.editForm.value.name),
      status: String(this.editForm.value.status)
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast('Mission updated!', 'success');
          this.router.navigateByUrl('/manage-missions');
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: (err) => {
        this.showToast(err.status === 409 ? 'Name already in use.' : 'Error saving.', 'danger');
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ready': return 'success';
      case 'draft': return 'warning';
      case 'done':  return 'medium';
      default:      return 'primary';
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    toast.present();
  }
}