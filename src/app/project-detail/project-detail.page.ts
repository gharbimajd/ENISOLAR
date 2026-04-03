import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ProjectService, Project, ProjectMission } from '../services/project.service';
import { MissionService } from '../services/mission';
import { addIcons } from 'ionicons';
import {
  addOutline, closeOutline, closeCircleOutline,
  mapOutline, chevronBackOutline, checkmarkCircleOutline,
  paperPlaneOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.page.html',
  styleUrls: ['./project-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ProjectDetailPage implements OnInit {
  project: Project | undefined;
  allMissions: any[] = [];
  availableMissions: any[] = [];
  selectedIds: Set<string> = new Set();
  showAddPanel = false;
  isLoadingMissions = false;
  isLoading = true;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private missionService: MissionService,
    private toastCtrl: ToastController
  ) {
    addIcons({ addOutline, closeOutline, closeCircleOutline, mapOutline, chevronBackOutline, checkmarkCircleOutline, paperPlaneOutline });
    const nav = this.router.currentNavigation();
    this.project = nav?.extras?.state?.['project'];
  }

  ngOnInit() { this.refreshProject(); }
  ionViewWillEnter() { this.refreshProject(); }

  refreshProject() {
    if (!this.project) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;
    this.projectService.getProjects(userId).subscribe({
      next: (projects) => {
        const updated = projects.find(p => p.id === this.project!.id);
        if (updated) this.project = updated;
        this.computeAvailable();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  computeAvailable() {
    const inProject = new Set(this.project?.missions.map(m => m.id));
    this.availableMissions = this.allMissions.filter(m => !inProject.has(m.id));
  }

  toggleAddPanel() {
    this.showAddPanel = !this.showAddPanel;
    if (this.showAddPanel && this.allMissions.length === 0) {
      this.isLoadingMissions = true;
      this.missionService.getMissions().subscribe({
        next: (missions: any) => {
          this.allMissions = missions;
          this.computeAvailable();
          this.isLoadingMissions = false;
        },
        error: () => { this.isLoadingMissions = false; }
      });
    }
  }

  addMission(mission: any) {
    if (!this.project) return;
    this.projectService.addMissionToProject(this.project.id, mission.id).subscribe({
      next: () => { this.refreshProject(); this.showAddPanel = false; this.showToast('Mission added', 'success'); },
      error: () => { this.showToast('Failed to add mission', 'danger'); }
    });
  }

  removeMission(mission: ProjectMission, event: Event) {
    if (!this.project) return;
    event.stopPropagation();
    this.projectService.removeMissionFromProject(this.project.id, mission.id).subscribe({
      next: () => { this.refreshProject(); this.showToast('Mission removed', 'success'); },
      error: () => { this.showToast('Failed to remove mission', 'danger'); }
    });
  }

  toggleSelect(mission: ProjectMission) {
    if (this.selectedIds.has(mission.id)) {
      this.selectedIds.delete(mission.id);
    } else {
      this.selectedIds.add(mission.id);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  isSelected(mission: ProjectMission): boolean {
    return this.selectedIds.has(mission.id);
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ready':   return 'success';
      case 'draft':   return 'warning';
      case 'done':    return 'medium';
      default:        return 'primary';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ready':   return 'ready';
      case 'pending': return 'pending';
      case 'draft':   return 'draft';
      case 'done':    return 'done';
      default:        return 'draft';
    }
  }

  async sendSelected() {
    const ids = Array.from(this.selectedIds);
    const toast = await this.toastCtrl.create({
      message: `Ready to send ${ids.length} mission(s): ${ids.join(', ')}`,
      duration: 3000,
      color: 'success',
      position: 'bottom'
    });
    toast.present();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    toast.present();
  }
}