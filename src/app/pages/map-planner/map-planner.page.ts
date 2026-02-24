import { Component, OnDestroy, signal, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// ✅ Import specific Standalone Components
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonBackButton, 
  IonSpinner, 
  IonIcon, 
  IonInput, 
  IonRange, 
  IonButton 
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';
import * as L from 'leaflet';

import { addIcons } from 'ionicons'; 
import { 
  optionsOutline, 
  chevronDownOutline, 
  arrowUndoOutline, 
  trashOutline, 
  saveOutline, 
  airplaneOutline,
  locateOutline,   
  settingsOutline,
  arrowBack,
  arrowUp,
  speedometer,
  layers,
  compass,
  camera,
  resizeOutline,    // Added for your stats capsule
  timeOutline,      // Added for your stats capsule
  navigateOutline,  // Added for your stats capsule
  eyeOutline,       // Added for your stats capsule
  checkmarkDoneOutline // Added for your "Done" button
} from 'ionicons/icons';

import { Mission, Waypoint } from '../../models/mission.model';
import { MissionService } from 'src/app/services/mission'; 

@Component({
  selector: 'app-map-planner',
  templateUrl: './map-planner.page.html',
  styleUrls: ['./map-planner.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    // ✅ Include all specific Ionic components here
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonButtons, 
    IonBackButton, 
    IonSpinner, 
    IonIcon, 
    IonInput, 
    IonRange, 
  
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {
  // --- State Signals ---
  mission = signal<Mission | null>(null);
  isDrawing = signal(true);
  sidebarOpen = signal(true);
  
  // 1. ADD THIS NEW SIGNAL TO PREVENT DOUBLE CLICKS
  isSaving = signal(false); 

  // --- Internal State ---
  private map!: L.Map;
  private currentMission: Mission | null = null;
  private polygonLayer?: L.Polygon;
  private flightPathLayer?: L.Polyline;
  private markers: L.Layer[] = []; 

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ 
      'options-outline': optionsOutline, 
      'chevron-down-outline': chevronDownOutline,
      'arrow-undo-outline': arrowUndoOutline,
      'trash-outline': trashOutline,
      'save-outline': saveOutline,
      'airplane-outline': airplaneOutline,
      'locate-outline': locateOutline,
      'settings-outline': settingsOutline,
      'arrow-back': arrowBack,
      'arrow-up': arrowUp,
      'speedometer': speedometer,
      'layers': layers,
      'compass': compass,
      'camera': camera,
       'checkmark-done-outline':checkmarkDoneOutline,
    });
  }

  // ... (Lifecycle hooks remain the same) ...
  ionViewWillEnter() {
    if (!this.map) setTimeout(() => this.initMap(), 100);
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.missionService.getMissionById(id).subscribe(loaded => {
        if (loaded) this.initializeMission(loaded);
        else this.createFreshMission();
      });
    } else {
      this.createFreshMission();
    }
  }

  ionViewDidEnter() {
    if (this.map) this.map.invalidateSize();
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  // ... (Initialization logic remains the same) ...
  private initializeMission(m: Mission) {
    this.currentMission = m;
    this.updateSignal();
    this.isDrawing.set(m.polygonPoints.length < 3);
    setTimeout(() => {
      this.renderAll();
      if (this.polygonLayer && this.map && m.polygonPoints.length > 0) {
        this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] });
      }
    }, 200);
  }

  private createFreshMission() {
    const newMission: Mission = {
      id: `mission_${Date.now()}`,
      user_id: localStorage.getItem('user_id') || '',
      name: ``,
      status: 'Draft',
      date: new Date(),
      areaSize: 0, totalDistance: 0, estimatedTime: 0, waypointCount: 0, gsd: 0,
      polygonPoints: [],
      flightPath: [],
      config: {
        altitude: 60, speed: 10, gridAngle: 0, overlapFront: 80, overlapSide: 70,
        orientationMode: 'CourseAligned',
        camera: { modelName: 'DJI Mini 3 Pro', sensorWidth: 9.6, sensorHeight: 7.2, focalLength: 6.72, imageWidth: 4032, imageHeight: 3024 }
      }
    };
    this.initializeMission(newMission);
  }

  private updateSignal() {
    if (this.currentMission) this.mission.set({ ...this.currentMission });
    this.cdr.markForCheck();
  }

  // --- MAP LOGIC (ZOOM BUTTONS REMOVED) ---
  private initMap() {
    if (this.map) return; 

    // Zoom buttons disabled here via zoomControl: false
    this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([36.8, 10.18], 13);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(this.map);
    
    // NOTE: L.control.zoom line is deleted as requested!

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => {
        if (this.isDrawing() && this.currentMission) {
          this.currentMission.polygonPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
          this.ifPolygonValid(() => this.recalculateFlightPath());
          this.renderAll();
          this.updateSignal();
        }
      });
    });
  }

  // ... (Render Logic remains the same) ...
  private renderAll() {
    if (!this.map || !this.currentMission) return;
    if (this.polygonLayer) this.map.removeLayer(this.polygonLayer);
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    const points = this.currentMission.polygonPoints;
    if (points.length === 0) return;
    const latlngs = points.map(p => L.latLng(p.lat, p.lng));

    this.polygonLayer = L.polygon(latlngs, { color: '#2dd36f', weight: 3, fill: true, fillColor: '#2dd36f', fillOpacity: 0.15 }).addTo(this.map);
    points.forEach((p, idx) => this.addVertexMarker(p, idx));
    if (points.length >= 2) this.addGhostMarkers(points);
    this.renderFlightPath();
  }

  private addVertexMarker(p: Waypoint, index: number) {
    const marker = L.marker([p.lat, p.lng], { icon: this.getVertexIcon(), draggable: true }).addTo(this.map);
    this.zone.runOutsideAngular(() => {
      marker.on('drag', (e: any) => {
        const latlngs = (this.polygonLayer?.getLatLngs() as any)[0];
        if (latlngs) {
          latlngs[index] = e.target.getLatLng();
          this.polygonLayer?.setLatLngs(latlngs); 
        }
      });
    });
    marker.on('dragend', (e: any) => {
      this.zone.run(() => {
        if (!this.currentMission) return;
        this.currentMission.polygonPoints[index] = { lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng };
        this.recalculateFlightPath();
        this.renderAll(); 
        this.updateSignal();
      });
    });
    this.markers.push(marker);
  }

  private addGhostMarkers(points: Waypoint[]) {
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length]; 
      const mid = { lat: (curr.lat + next.lat) / 2, lng: (curr.lng + next.lng) / 2 };
      const marker = L.marker([mid.lat, mid.lng], { icon: this.getGhostIcon(), draggable: true, zIndexOffset: -100 }).addTo(this.map);
      marker.on('dragend', (e: any) => {
        this.zone.run(() => {
          if (!this.currentMission) return;
          this.currentMission.polygonPoints.splice(i + 1, 0, { lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng });
          this.recalculateFlightPath();
          this.renderAll();
          this.updateSignal();
        });
      });
      this.markers.push(marker);
    }
  }

  private renderFlightPath() {
    if (this.flightPathLayer) this.map.removeLayer(this.flightPathLayer);
    if (!this.currentMission?.flightPath || this.currentMission.flightPath.length === 0) return;
    this.flightPathLayer = L.polyline(this.currentMission.flightPath.map(p => [p.lat, p.lng]), { color: 'rgb(24, 27, 60)', weight: 3, dashArray: '10, 5' }).addTo(this.map);
  }

  // ... (Recalculate logic remains the same) ...
  recalculateFlightPath() {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) {
      this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    }
  }

  onConfigChange() {
    this.ifPolygonValid(() => {
      this.recalculateFlightPath();
      this.renderAll(); 
      this.updateSignal();
    });
  }

  undoLastPoint() {
    if (!this.currentMission?.polygonPoints.length) return;
    this.currentMission.polygonPoints.pop();
    if (this.currentMission.polygonPoints.length < 3) this.currentMission.flightPath = [];
    else this.recalculateFlightPath();
    this.renderAll();
    this.updateSignal();
  }

  clearPolygon() {
    if (!this.currentMission) return;
    this.currentMission.polygonPoints = [];
    this.currentMission.flightPath = [];
    this.isDrawing.set(true);
    this.renderAll();
    this.updateSignal();
  }
  updateMissionName(newName: string) {
  if (this.currentMission) {
    this.currentMission.name = newName;
    // This triggers your existing updateSignal logic to refresh the UI
    this.updateSignal();
  }
}

  // --- 2. UPDATED SAVE LOGIC ---
  saveMission() {
    if (!this.currentMission) return;

    // Check if already saving
    if (this.isSaving()) {
      return; 
    }

    // Set lock
    this.isSaving.set(true);

    this.missionService.saveMission(this.currentMission).subscribe({
      next: () => {
        this.router.navigate(['/home']);
        // No need to reset isSaving to false because we are leaving the page
      },
      error: (e) => {
        console.error('Save failed', e);
        // Unlock if it fails so user can try again
        this.isSaving.set(false);
      }
    });
  }

  // ... (Helpers remain the same) ...
  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }
  finishDrawing() { this.isDrawing.set(false); }
  
  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  }

  private ifPolygonValid(fn: () => void) {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) fn();
  }

  private getVertexIcon() {
    return L.divIcon({ className: '', html: `<div style="background:#fff; width:16px; height:16px; border-radius:50%; border:3px solid #2dd36f; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
  }

  private getGhostIcon() {
    return L.divIcon({ className: '', html: `<div style="background:#fff; width:12px; height:12px; border-radius:50%; border:2px solid #2dd36f; opacity:0.5;"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
  }
}