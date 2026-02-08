import { Component, OnDestroy, signal, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ViewWillEnter, ViewDidEnter } from '@ionic/angular';
import * as L from 'leaflet';

// 1. Imports for Icons
import { addIcons } from 'ionicons'; 
import { 
  optionsOutline, 
  chevronDownOutline, 
  arrowUndoOutline, 
  trashOutline, 
  saveOutline, 
  airplaneOutline,
  locateOutline,   // Added these two just in case you use them in HTML
  settingsOutline 
} from 'ionicons/icons';

import { Mission, Waypoint } from '../../models/mission.model';
import { MissionService } from 'src/app/services/mission'; // Ensure path is correct

@Component({
  selector: 'app-map-planner',
  templateUrl: './map-planner.page.html',
  styleUrls: ['./map-planner.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class MapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {
  // --- State Signals (UI Binds to these) ---
  mission = signal<Mission | null>(null);
  isDrawing = signal(true);
  sidebarOpen = signal(true);

  // --- Internal State ---
  private map!: L.Map;
  private currentMission: Mission | null = null;
  
  // --- Map Layers & Markers ---
  private polygonLayer?: L.Polygon;
  private maskLayer?: L.Polygon;
  private flightPathLayer?: L.Polyline;
  private markers: L.Layer[] = []; 

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    // 2. REGISTER ICONS (Fixes the Crash)
    addIcons({ 
      'options-outline': optionsOutline, 
      'chevron-down-outline': chevronDownOutline,
      'arrow-undo-outline': arrowUndoOutline,
      'trash-outline': trashOutline,
      'save-outline': saveOutline,
      'airplane-outline': airplaneOutline,
      'locate-outline': locateOutline,
      'settings-outline': settingsOutline
    });
  }

  // ============================================================
  // 1. LIFECYCLE HOOKS
  // ============================================================

  ionViewWillEnter() {
    if (!this.map) setTimeout(() => this.initMap(), 100);

    const id = this.route.snapshot.paramMap.get('id');
    console.log('📍 ROUTE ID:', id); 

    if (id && id !== 'new') {
      this.missionService.getMissionById(id).subscribe(loaded => {
        console.log('📦 LOADED DATA:', loaded); 

        if (loaded) {
          this.initializeMission(loaded);
        } else {
          console.error('❌ Mission not found! Creating fresh one.'); 
          this.createFreshMission();
        }
      });
    } else {
      console.log('🆕 No ID provided. Creating fresh mission.');
      this.createFreshMission();
    }
  }

  ionViewDidEnter() {
    // CRITICAL: Forces map to fill container and UI to render
    if (this.map) this.map.invalidateSize();
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  // ============================================================
  // 2. DATA INITIALIZATION
  // ============================================================

  private initializeMission(m: Mission) {
    this.currentMission = m;
    this.updateSignal();
    this.isDrawing.set(m.polygonPoints.length < 3);
    
    // Delay render slightly to ensure map is ready
    setTimeout(() => {
      this.renderAll();
      if (this.polygonLayer && this.map) {
        // Only fit bounds if we actually have points
        if (m.polygonPoints.length > 0) {
            this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] });
        }
      }
    }, 200);
  }

  private createFreshMission() {
    const newMission: Mission = {
      id: `mission_${Date.now()}`,
      name: `Mission ${new Date().toLocaleDateString()}`,
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
    // Creates a new reference to trigger Angular change detection
    if (this.currentMission) this.mission.set({ ...this.currentMission });
  }

  // ============================================================
  // 3. MAP LOGIC
  // ============================================================

  private initMap() {
    if (this.map) return; // Prevent double init

    this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([36.8, 10.18], 13);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.isDrawing() && this.currentMission) {
        this.currentMission.polygonPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
        this.ifPolygonValid(() => this.recalculateFlightPath());
        this.renderAll();
        this.updateSignal();
      }
    });
  }

  private renderAll() {
    if (!this.map || !this.currentMission) return;

    // 1. Clear Old Layers
    if (this.polygonLayer) this.map.removeLayer(this.polygonLayer);
    if (this.maskLayer) this.map.removeLayer(this.maskLayer);
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    const points = this.currentMission.polygonPoints;
    if (points.length === 0) return;

    const latlngs = points.map(p => L.latLng(p.lat, p.lng));

    // 2. Draw Polygon
    this.polygonLayer = L.polygon(latlngs, { color: '#2dd36f', weight: 2, fill: false }).addTo(this.map);

    // 3. Draw Mask (Darken world outside polygon)
    if (points.length >= 3) {
      // Create a large box covering the world
      const worldBounds = [
        new L.LatLng(90, -180),
        new L.LatLng(90, 180),
        new L.LatLng(-90, 180),
        new L.LatLng(-90, -180)
      ];
      // Leaflet handles holes if passed as [outer, hole]
      this.maskLayer = L.polygon([worldBounds, latlngs], { 
        color: 'transparent', fillColor: '#000', fillOpacity: 0.6 
      }).addTo(this.map);
    }

    // 4. Draw Vertex Markers
    points.forEach((p, idx) => this.addVertexMarker(p, idx));

    // 5. Draw Ghost Markers (for inserting points)
    if (points.length >= 2) this.addGhostMarkers(points);

    // 6. Draw Flight Path
    this.renderFlightPath();
  }

  private addVertexMarker(p: Waypoint, index: number) {
    const marker = L.marker([p.lat, p.lng], { icon: this.getVertexIcon(), draggable: true }).addTo(this.map);
    
    // Visual update only while dragging (Performance)
    marker.on('drag', (e: any) => {
      const latlngs = (this.polygonLayer?.getLatLngs() as any)[0];
      if (latlngs) {
          latlngs[index] = e.target.getLatLng();
          this.polygonLayer?.setLatLngs(latlngs); // Just update the line, don't re-render everything
      }
    });

    // Data update when drag finishes
    marker.on('dragend', (e: any) => {
      if (!this.currentMission) return;
      this.currentMission.polygonPoints[index] = { lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng };
      this.recalculateFlightPath();
      this.renderAll(); // Re-render to update ghosts and path
      this.updateSignal();
    });

    this.markers.push(marker);
  }

  private addGhostMarkers(points: Waypoint[]) {
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length]; // Wrap around
      const mid = { lat: (curr.lat + next.lat) / 2, lng: (curr.lng + next.lng) / 2 };

      const marker = L.marker([mid.lat, mid.lng], { icon: this.getGhostIcon(), draggable: true, zIndexOffset: -100 }).addTo(this.map);

      marker.on('dragend', (e: any) => {
        if (!this.currentMission) return;
        // Insert new point at index + 1
        this.currentMission.polygonPoints.splice(i + 1, 0, { lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng });
        this.recalculateFlightPath();
        this.renderAll();
        this.updateSignal();
      });

      this.markers.push(marker);
    }
  }

  private renderFlightPath() {
    if (this.flightPathLayer) this.map.removeLayer(this.flightPathLayer);
    
    // Safety check
    if (!this.currentMission?.flightPath || this.currentMission.flightPath.length === 0) return;

    this.flightPathLayer = L.polyline(
      this.currentMission.flightPath.map(p => [p.lat, p.lng]), 
      { color: '#ffc409', weight: 3, dashArray: '10, 5' } // Yellow color for better visibility
    ).addTo(this.map);
  }

  // ============================================================
  // 4. LOGIC & EVENTS
  // ============================================================

  recalculateFlightPath() {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) {
      this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    }
  }

  onConfigChange() {
    // Re-render everything to ensure flight path updates visually
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

  saveMission() {
    if (!this.currentMission) return;
    this.missionService.saveMission(this.currentMission).subscribe({
      next: () => {
        // Correct way to navigate in Ionic/Angular
        this.router.navigate(['/home']);
      },
      error: (e) => console.error('Save failed', e)
    });
  }


  // ============================================================
  // 5. HELPERS
  // ============================================================

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