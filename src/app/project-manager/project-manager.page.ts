import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../services/project.service';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, trashOutline, folderOutline, chevronForwardOutline,mapOutline } from 'ionicons/icons';

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.page.html',
  styleUrls: ['./project-manager.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProjectManagerPage implements OnInit {
  projects: Project[] = [];
  showCreateForm = false;
  newProjectName = '';
  isSubmitting = false;
  isLoading = true;

  constructor(
    private projectService: ProjectService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({ addOutline, closeOutline, trashOutline, folderOutline, chevronForwardOutline ,mapOutline});
  }

  ngOnInit() { this.loadProjects(); }
  ionViewWillEnter() { this.loadProjects(); }

  loadProjects() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoading = true;
    this.projectService.getProjects(userId).subscribe({
      next: (projects) => { this.projects = projects; this.isLoading = false; },
      error: () => { this.showToast('Failed to load projects', 'danger'); this.isLoading = false; }
    });
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    this.newProjectName = '';
  }

  submitCreate() {
    const userId = localStorage.getItem('user_id');
    if (!userId || !this.newProjectName.trim() || this.isSubmitting) return;
    this.isSubmitting = true;
    this.projectService.createProject(userId, this.newProjectName.trim()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showCreateForm = false;
        this.newProjectName = '';
        this.loadProjects();
        this.showToast('Project created', 'success');
      },
      error: () => { this.isSubmitting = false; this.showToast('Failed to create project', 'danger'); }
    });
  }

  deleteProject(project: Project, event: Event) {
    event.stopPropagation();
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.projectService.deleteProject(userId, project.id).subscribe({
      next: () => { this.loadProjects(); this.showToast('Project deleted', 'success'); },
      error: () => { this.showToast('Failed to delete project', 'danger'); }
    });
  }

  openProject(project: Project) {
    this.router.navigateByUrl('/project-detail', { state: { project } });
  }

  countByStatus(project: Project, status: string): number {
    return project.missions.filter(m => m.status === status).length;
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    toast.present();
  }
  get totalMissions(): number {
  return this.projects.reduce((sum, p) => sum + p.missions.length, 0);
}
}