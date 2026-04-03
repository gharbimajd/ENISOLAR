import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MissionService } from '../services/mission';

@Component({
  selector: 'app-manage-missions',
  templateUrl: './manage-missions.page.html',
  styleUrls: ['./manage-missions.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ManageMissionsPage implements OnInit {
  missions: any[] = [];

  constructor(
    private missionService: MissionService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadMissions();
  }

  ionViewWillEnter() {
    // Refresh list when coming back from edit page
    this.loadMissions();
  }

  loadMissions() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    this.missionService.getMissions().subscribe({
      next: (missions: any) => { this.missions = missions; },
      error: () => { this.showToast('Failed to load missions', 'danger'); }
    });
  }

  goToEdit(mission: any) {
    // Pass mission data via router state — no params needed in URL
    this.router.navigateByUrl('/edit-mission', {
      state: { mission, allMissions: this.missions }
    });
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
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