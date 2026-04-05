import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../services/project.service';
import { addIcons } from 'ionicons';
import {
  folderOutline, chevronDownOutline, chevronForwardOutline,
  checkmarkCircleOutline, searchOutline, mapOutline,
  paperPlaneOutline, closeCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-mission-picker',
  templateUrl: './mission-picker.page.html',
  styleUrls: ['./mission-picker.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class MissionPickerPage implements OnInit {
  drone: any = null;
  slots: any[] = [];
  projects: Project[] = [];
  isLoading = true;
  searchQuery = '';
  expandedProjectIds: Set<string> = new Set();
  selectedMissions: any[] = []; // ordered list
  emptySlotCount = 0;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private toastCtrl: ToastController
  ) {
    addIcons({ folderOutline, chevronDownOutline, chevronForwardOutline, checkmarkCircleOutline, searchOutline, mapOutline, paperPlaneOutline, closeCircleOutline });
    const nav = this.router.currentNavigation();
    this.drone = nav?.extras?.state?.['drone'];
    this.slots = nav?.extras?.state?.['slots'] ?? [];
  }

  ngOnInit() {
    if (!this.drone) { this.router.navigateByUrl('/send-drone'); return; }
    this.computeEmptySlots();
    this.loadProjects();
  }

  computeEmptySlots() {
    this.emptySlotCount = this.slots.filter((s: any) => !s.mission_id).length;
  }

  loadProjects() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;
    this.projectService.getProjects(userId).subscribe({
      next: (projects) => { this.projects = projects; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  toggleProject(projectId: string) {
    if (this.expandedProjectIds.has(projectId)) {
      this.expandedProjectIds.delete(projectId);
    } else {
      this.expandedProjectIds.add(projectId);
    }
    this.expandedProjectIds = new Set(this.expandedProjectIds);
  }

  isExpanded(projectId: string): boolean {
    return this.expandedProjectIds.has(projectId);
  }

  get filteredProjects(): Project[] {
    if (!this.searchQuery.trim()) return this.projects;
    const q = this.searchQuery.toLowerCase();
    return this.projects
      .map(p => ({
        ...p,
        missions: p.missions.filter((m: any) => m.name.toLowerCase().includes(q))
      }))
      .filter(p => p.missions.length > 0);
  }

  isSelected(missionId: string): boolean {
    return this.selectedMissions.some(m => m.id === missionId);
  }

  selectionIndex(missionId: string): number {
    return this.selectedMissions.findIndex(m => m.id === missionId) + 1;
  }

  toggleMission(mission: any) {
    if (this.isSelected(mission.id)) {
      this.selectedMissions = this.selectedMissions.filter(m => m.id !== mission.id);
    } else {
      if (this.selectedMissions.length >= this.emptySlotCount) {
        this.showToast(`Only ${this.emptySlotCount} empty slot(s) available`, 'warning');
        return;
      }
      this.selectedMissions = [...this.selectedMissions, mission];
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

  proceed() {
    if (this.selectedMissions.length === 0) {
      this.showToast('Select at least one mission', 'warning');
      return;
    }
    this.router.navigateByUrl('/slot-assign', {
      state: {
        drone: this.drone,
        slots: this.slots,
        selectedMissions: this.selectedMissions
      }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    toast.present();
  }
}