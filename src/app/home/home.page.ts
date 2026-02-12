import { Component, OnInit, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 

// ✅ 1. Import Types separately to avoid "Cannot find name" build errors
import type { RefresherCustomEvent } from '@ionic/angular';

// ✅ 2. Specific Standalone Imports (matches your HTML exactly)
import { 
  IonHeader, 
  IonToolbar, 
  IonButtons, 
  IonMenuButton, 
  IonTitle, 
  IonSearchbar, 
  IonContent, 
  IonGrid, 
  IonRow, 
  IonCol, 
  IonCard, 
  IonIcon, 
  IonFab, 
  IonFabButton,
  IonRefresher, 
  IonRefresherContent 
} from '@ionic/angular/standalone';

import { Mission } from '../models/mission.model';
import { MissionService } from '../services/mission';

import { addIcons } from 'ionicons';
import { 
  add, 
  timeOutline, 
  alertCircleOutline, 
  cloudUploadOutline, 
  trashOutline, 
  mapOutline,
  listOutline,
  searchOutline,
  sunnyOutline,
  rainyOutline,
  thunderstormOutline,
  locationOutline,
  resizeOutline, 
  eyeOutline, 
  navigateOutline,
  analyticsOutline,
  play
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    // ✅ 3. Ensure ALL UI components used in HTML are listed here
    IonHeader, 
    IonToolbar, 
    IonButtons, 
    IonMenuButton, 
    IonTitle, 
    IonSearchbar, 
    IonContent, 
    IonGrid, 
    IonRow, 
    IonCol, 
    IonCard, 
    IonIcon, 
    IonFab, 
    IonFabButton,
    
  ]
})
export class HomePage implements OnInit {
  missions = signal<Mission[]>([]);
  searchQuery = signal('');

  filteredMissions = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const list = this.missions();
    if (!query) return list;

    return list.filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.status.toLowerCase().includes(query)
    );
  });

  weather = {
    temp: 24,
    condition: 'Sunny',
    wind: 12,
    icon: 'sunny-outline'
  };

  constructor(
    private router: Router,
    private missionService: MissionService,
    private zone: NgZone
  ) {
    addIcons({ 
      add, timeOutline, alertCircleOutline, cloudUploadOutline, 
      trashOutline, mapOutline, listOutline, searchOutline,
      sunnyOutline, rainyOutline, thunderstormOutline,
      locationOutline, resizeOutline, eyeOutline, navigateOutline,
      analyticsOutline, play 
    });
  }

  ngOnInit() {
    this.loadMissions();
  }

  ionViewWillEnter() {
    this.loadMissions();
  }

  loadMissions(event?: RefresherCustomEvent) {
    this.missionService.getMissions().subscribe({
      next: (data) => {
        this.missions.set(data);
        if (event) event.target.complete();
      },
      error: (err) => {
        console.error('Failed to load missions:', err);
        if (event) event.target.complete();
      }
    });
  }

  deleteMission(mission: Mission, event: Event) {
    event.stopPropagation();
    if (confirm(`Delete mission "${mission.name}" permanently?`)) {
      this.missionService.deleteMission(mission.id).subscribe({
        next: () => this.loadMissions(),
        error: (err) => console.error('Error deleting mission:', err)
      });
    }
  }

  onSearch(event: any) {
    this.searchQuery.set(event.detail.value || '');
  }

  refresh(ev: any) {
    this.loadMissions(ev);
  }

  // --- NAVIGATION USING FORCE RELOAD ---

  createNewMission() {
    // Forces a full page load to the new URL
    window.location.assign('/map-planner');
  }

  openMission(mission: Mission) {
    window.location.assign('/map-planner/' + mission.id);
  }
  //TODO: OPTIMIZATION - Currently using location.assign() to force navigation.
  viewMissionStatus(mission: any, event?: Event) {
    if (event) event.stopPropagation();
    
    // Pass the ID in the URL path
    this.router.navigate([`/mission-status/${mission.id}`]);
}

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  }
}