import { Component, OnInit, signal, computed, NgZone } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import type { RefresherCustomEvent } from '@ionic/angular';

import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle,
  IonSearchbar, IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonIcon, IonFab, IonFabButton
} from '@ionic/angular/standalone';

import { Mission } from '../models/mission.model';
import { MissionService } from '../services/mission';

import { addIcons } from 'ionicons';
import {
  add, timeOutline, alertCircleOutline, cloudUploadOutline,
  trashOutline, mapOutline, listOutline, searchOutline,
  sunnyOutline, rainyOutline, thunderstormOutline,
  locationOutline, resizeOutline, eyeOutline, navigateOutline,
  analyticsOutline, play, gridOutline
} from 'ionicons/icons';

export type MissionCategory = 'polygon' | 'matrix' | 'linear';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle,
    IonSearchbar, IonContent, IonGrid, IonRow, IonCol,
    IonCard, IonIcon, IonFab, IonFabButton,
  ]
})
export class HomePage implements OnInit {

  missions      = signal<Mission[]>([]);
  searchQuery   = signal('');
  activeCategory = signal<MissionCategory>('polygon');

  // ── Category helpers ──────────────────────────────────────────────────────

  /**
   * Derive type from mission ID suffix:
   *   ends with _M  → matrix
   *   ends with _L  → linear
   *   anything else → polygon  (legacy missions from save_mission.php)
   */
  /**
   * Uses mission_type field from DB (set by PHP on save):
   *   1 = Polygon  (save_mission.php)
   *   2 = Matrix   (save_mL.php, missionType M)
   *   3 = Linear   (save_mL.php, missionType L)
   * Old missions without the field default to 1 (Polygon).
   */
  getMissionType(m: any): MissionCategory {
    const t = Number(m?.missionType ?? 1);
    if (t === 2) return 'matrix';
    if (t === 3) return 'linear';
    return 'polygon';
  }

  getMissionTypeIcon(m: any): string {
    const t = this.getMissionType(m);
    if (t === 'matrix') return 'grid-outline';
    if (t === 'linear') return 'navigate-outline';
    return 'map-outline';
  }

  // ── Computed lists ────────────────────────────────────────────────────────

  polygonMissions = computed(() =>
    this.missions().filter(m => this.getMissionType(m) === 'polygon'));

  matrixMissions = computed(() =>
    this.missions().filter(m => this.getMissionType(m) === 'matrix'));

  linearMissions = computed(() =>
    this.missions().filter(m => this.getMissionType(m) === 'linear'));

  /** All missions in the active category */
  categoryMissions = computed(() => {
    switch (this.activeCategory()) {
      case 'matrix':  return this.matrixMissions();
      case 'linear':  return this.linearMissions();
      default:        return this.polygonMissions();
    }
  });

  /** Category missions further filtered by search query */
  filteredMissions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list  = this.categoryMissions();
    if (!query) return list;
    return list.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.status.toLowerCase().includes(query)
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

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
      analyticsOutline, play, gridOutline
    });
  }

  ngOnInit()         { this.loadMissions(); }
  ionViewWillEnter() { this.loadMissions(); }

  loadMissions(event?: RefresherCustomEvent) {
    this.missionService.getMissions().subscribe({
      next:  (data) => { this.missions.set(data); event?.target.complete(); },
      error: (err)  => { console.error('Failed to load missions:', err); event?.target.complete(); }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  setCategory(cat: MissionCategory) {
    this.activeCategory.set(cat);
  }

  deleteMission(mission: Mission, event: Event) {
    event.stopPropagation();
    if (confirm(`Delete mission "${mission.name}" permanently?`)) {
      this.missionService.deleteMission(mission.id).subscribe({
        next:  () => this.loadMissions(),
        error: (err) => console.error('Error deleting mission:', err)
      });
    }
  }

  onSearch(event: any) {
    this.searchQuery.set(event.detail.value || '');
  }

  refresh(ev: any) { this.loadMissions(ev); }

  createNewMission()              { window.location.assign('/map-planner'); }
  openMission(mission: Mission)   { window.location.assign('/map-planner/' + mission.id); }

  viewMissionStatus(mission: any, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate([`/mission-status/${mission.id}`]);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)} min`;
  }
}