import { Component, OnDestroy, signal, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, 
  IonBackButton, IonSpinner, IonIcon, IonInput, IonRange, IonButton 
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';
import * as L from 'leaflet';
import { addIcons } from 'ionicons'; 
import { 
  optionsOutline, chevronDownOutline, arrowUndoOutline, trashOutline, 
  saveOutline, airplaneOutline, locateOutline, settingsOutline,
  arrowBack, arrowUp, speedometer, layers, compass, camera,
  resizeOutline, timeOutline, navigateOutline, eyeOutline, checkmarkDoneOutline 
} from 'ionicons/icons';

import { Mission, Waypoint } from '../../models/mission.model';
import { MissionService } from 'src/app/services/mission'; 

@Component({
  selector: 'app-map-planner',
  templateUrl: './map-planner.page.html',
  styleUrls: ['./map-planner.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, 
    IonSpinner, IonIcon, IonInput, IonRange, 
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {
  // --- State Signals ---
  mission = signal<Mission | null>(null);
  isDrawing = signal(true);
  sidebarOpen = signal(true);
  isSaving = signal(false); 
  isReady = signal(false); 

  // --- Internal State ---
  private map!: L.Map;
  private currentMission: Mission | null = null;
  private polygonLayer?: L.Polygon;
  private flightPathLayer?: L.Polyline;
  private markers: L.Layer[] = []; 
  private configTimeout: any;
  private isRendering = false; // Prevents frame collisions

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ 
      'options-outline': optionsOutline, 'chevron-down-outline': chevronDownOutline,
      'arrow-undo-outline': arrowUndoOutline, 'trash-outline': trashOutline,
      'save-outline': saveOutline, 'airplane-outline': airplaneOutline,
      'locate-outline': locateOutline, 'settings-outline': settingsOutline,
       'arrow-up': arrowUp, 'speedometer': speedometer,
      'layers': layers, 'compass': compass, 'camera': camera,
      'resize-outline': resizeOutline, 'time-outline': timeOutline,
      'navigate-outline': navigateOutline, 'eye-outline': eyeOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
    });
  }

  // --- LIFECYCLE ---
  ionViewWillEnter() {
    this.isReady.set(false);
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.missionService.getMissionById(id).subscribe(loaded => {
        this.currentMission = loaded || this.createFreshMissionObject();
        this.mission.set(this.currentMission);
        this.isDrawing.set((this.currentMission?.polygonPoints?.length || 0) < 3);
        this.cdr.markForCheck();
      });
    } else {
      this.currentMission = this.createFreshMissionObject();
      this.mission.set(this.currentMission);
      this.isDrawing.set(true);
    }
  }

  async ionViewDidEnter() {
    // Give the CPU a 60ms break before slamming it with Map Init
    await new Promise(resolve => setTimeout(resolve, 60));

    this.zone.runOutsideAngular(() => {
      if (!this.map) {
        this.initMap();
      } else {
        this.map.invalidateSize();
      }
      this.renderAll();
      
      if (this.currentMission?.polygonPoints.length) {
        const bounds = L.latLngBounds(this.currentMission.polygonPoints.map(p => [p.lat, p.lng]));
        this.map.fitBounds(bounds, { animate: false, padding: [40, 40] });
      }

      this.zone.run(() => {
        this.isReady.set(true);
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  // --- SMOOTH CONFIG INTERACTION ---
  onConfigChange() {
    // 1. Update signal so UI labels change instantly
    this.updateSignal();

    if (this.configTimeout) clearTimeout(this.configTimeout);

    // 2. Wait 120ms (debounce) so the math doesn't choke the slider movement
    this.configTimeout = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.ifPolygonValid(() => {
          this.recalculateFlightPath();
          // Use requestAnimationFrame to sync render with screen refresh (60fps)
          requestAnimationFrame(() => this.renderAll());
        });
      });
    }, 120); 
  }

  // --- MAP CORE ---
  private initMap() {
    this.map = L.map('map', { 
      zoomControl: false, 
      attributionControl: false,
      preferCanvas: true, // GPU power for markers/lines
      zoomSnap: 0.5
    }).setView([36.8, 10.18], 13);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
      maxZoom: 19,
      updateWhenIdle: true // Performance boost during pan/zoom
    }).addTo(this.map);

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

  private renderAll() {
    if (!this.map || !this.currentMission || this.isRendering) return;
    this.isRendering = true;

    // Clean layers
    if (this.polygonLayer) this.map.removeLayer(this.polygonLayer);
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    const points = this.currentMission.polygonPoints;
    if (points.length > 0) {
      const latlngs = points.map(p => L.latLng(p.lat, p.lng));
      this.polygonLayer = L.polygon(latlngs, { 
        color: '#2dd36f', weight: 3, fill: true, fillColor: '#2dd36f', fillOpacity: 0.15 
      }).addTo(this.map);

      points.forEach((p, idx) => this.addVertexMarker(p, idx));
      if (points.length >= 2) this.addGhostMarkers(points);
      this.renderFlightPath();
    }
    
    this.isRendering = false;
    this.cdr.detectChanges(); // Final UI sync
  }

  private addVertexMarker(p: Waypoint, index: number) {
    const marker = L.marker([p.lat, p.lng], { 
      icon: this.getVertexIcon(), draggable: true 
    }).addTo(this.map);

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
        this.currentMission.polygonPoints[index] = { 
          lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng 
        };
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
      
      const marker = L.marker([mid.lat, mid.lng], { 
        icon: this.getGhostIcon(), draggable: true, zIndexOffset: -100 
      }).addTo(this.map);

      marker.on('dragend', (e: any) => {
        this.zone.run(() => {
          if (!this.currentMission) return;
          this.currentMission.polygonPoints.splice(i + 1, 0, { 
            lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng 
          });
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
    const path = this.currentMission?.flightPath;
    if (!path || path.length === 0) return;

    this.flightPathLayer = L.polyline(path.map(p => [p.lat, p.lng]), { 
      color: 'rgb(24, 27, 60)', weight: 3, dashArray: '10, 5', interactive: false 
    }).addTo(this.map);
  }

  recalculateFlightPath() {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) {
      this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    }
  }

  private updateSignal() {
    if (this.currentMission) {
      this.mission.set({ ...this.currentMission }); // Create new ref for OnPush detection
      this.cdr.markForCheck();
    }
  }

  // --- REMAINING UTILS (UNTOUCHED) ---
  private createFreshMissionObject(): Mission {
    return {
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
  }

  undoLastPoint() {
    if (!this.currentMission?.polygonPoints.length) return;
    this.currentMission.polygonPoints.pop();
    if (this.currentMission.polygonPoints.length < 3) {
      this.currentMission.flightPath = [];
    } else {
      this.recalculateFlightPath();
    }
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
      this.updateSignal();
    }
  }

  saveMission() {
    if (!this.currentMission || this.isSaving()) return;
    this.isSaving.set(true);
    this.missionService.saveMission(this.currentMission).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (e) => {
        console.error('Save failed', e);
        this.isSaving.set(false);
      }
    });
  }

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }
  finishDrawing() { this.isDrawing.set(false); }
  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  }
  private ifPolygonValid(fn: () => void) {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) fn();
  }
  private getVertexIcon() {
    return L.divIcon({ 
      className: '', 
      html: `<div style="background:#fff; width:16px; height:16px; border-radius:50%; border:3px solid #2dd36f; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`, 
      iconSize: [16, 16], iconAnchor: [8, 8] 
    });
  }
  private getGhostIcon() {
    return L.divIcon({ 
      className: '', 
      html: `<div style="background:#fff; width:12px; height:12px; border-radius:50%; border:2px solid #2dd36f; opacity:0.5;"></div>`, 
      iconSize: [12, 12], iconAnchor: [6, 6] 
    });
  }
}