import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, ValidationErrors } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { MissionService } from '../services/mission'; // Adjust path if needed

@Component({
  selector: 'app-manage-missions',
  templateUrl: './manage-missions.page.html',
  styleUrls: ['./manage-missions.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule]
})
export class ManageMissionsPage implements OnInit {
  missions: any[] = [];
  
  // Modal & Form state
  isModalOpen = false;
  editForm!: FormGroup;
  selectedMission: any = null;

  constructor(
    private fb: FormBuilder,
    private missionService: MissionService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadMissions();

    // Set up the form with our custom Unique Name Validator
    this.editForm = this.fb.group({
      name: ['', [Validators.required]],
      status: ['draft', [Validators.required]]
    }, { validators: this.uniqueNameValidator.bind(this) });
  }

loadMissions() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    // Call your existing get_missions.php
    this.missionService.getMissions().subscribe({
      next: (missions: any) => {
        this.missions = missions;
      },
      error: (err) => {
        console.error('Failed to load missions', err);
        this.showToast('Failed to load missions from server', 'danger');
      }
    });
  }

  // --- CUSTOM VALIDATOR: Checks if name already exists ---
  uniqueNameValidator(group: FormGroup): ValidationErrors | null {
    const newName = group.get('name')?.value?.trim().toLowerCase();
    
    if (!newName || !this.selectedMission) return null;

    // Check if any OTHER mission has this exact name
    const isDuplicate = this.missions.some(m => 
      m.id !== this.selectedMission.id && 
      m.name.toLowerCase() === newName
    );

    // If duplicate is true, attach an error called 'nameExists'
    return isDuplicate ? { nameExists: true } : null;
  }

  // --- MODAL CONTROLS ---
  openEditModal(mission: any) {
    this.selectedMission = mission;
    
    // Pre-fill the form with the clicked mission's data
    this.editForm.patchValue({
      name: mission.name,
      status: mission.status
    });
    
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedMission = null;
    this.editForm.reset();
  }

  // --- SAVE LOGIC ---
  saveMission() {
    if (this.editForm.invalid) return;

    // 1. Grab the ID first
    const userId = localStorage.getItem('user_id');

    // 2. Safety check: If it's null, stop immediately!
    if (!userId) {
      this.showToast('Error: User session not found.', 'danger');
      return; 
    }

    // 3. Build the object and force everything to be a String
    const updatedData = {
      user_id: userId, // Now TypeScript knows this is 100% a string
      mission_id: String(this.selectedMission.id),
      name: String(this.editForm.value.name),
      status: String(this.editForm.value.status)
    };

    // 4. Send it to the service
    this.missionService.updateMission(updatedData).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast('Mission updated successfully!', 'success');
          this.closeModal();
          this.loadMissions(); // Refresh the list from the server!
        } else {
          this.showToast(res.message, 'danger');
        }
      },
      error: (err) => {
        if (err.status === 409) {
          this.showToast('That name is already in use by another mission.', 'warning');
        } else {
          this.showToast('Error saving mission', 'danger');
        }
      }
    });
  }
  // --- UI HELPERS ---
  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'ready': return 'success';
      case 'draft': return 'warning';
      case 'done':  return 'medium';
      default:      return 'primary';
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}