import { Component, OnDestroy, signal, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';


import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, 
  IonBackButton, IonSpinner, IonIcon, IonInput, IonRange, IonButton 
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';

// --- NEW 3D MAP ENGINE ---
import * as mapboxgl from 'mapbox-gl';

import { addIcons } from 'ionicons'; 
import { 
  optionsOutline, chevronDownOutline, arrowUndoOutline, trashOutline, 
  saveOutline, airplaneOutline, locateOutline, settingsOutline,
  arrowBack, arrowUp, speedometer, layers, compass, camera,
  resizeOutline, timeOutline, navigateOutline, eyeOutline, checkmarkDoneOutline,
  cubeOutline, mapOutline // <-- Here are the two new ones!
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
  is3DMode = signal(true);
  

  // --- Internal State ---
  private map!: mapboxgl.Map; // Upgraded to Mapbox
  private currentMission: Mission | null = null;
  private markers: mapboxgl.Marker[] = []; // Upgraded to Mapbox Markers
  private configTimeout: any;
  private isRendering = false;
  private isMapLayerReady = false; // Ensures 3D map is loaded before drawing

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
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
      'resize-outline': resizeOutline, 
      'time-outline': timeOutline,
      'navigate-outline': navigateOutline, 
      'eye-outline': eyeOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'cube-outline': cubeOutline, 
      'map-outline': mapOutline
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
    await new Promise(resolve => setTimeout(resolve, 60));

    this.zone.runOutsideAngular(() => {
      if (!this.map) {
        this.initMap();
      } else {
        this.map.resize();
      }
    });
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  // --- SMOOTH CONFIG INTERACTION ---
  onConfigChange() {
    this.updateSignal();
    if (this.configTimeout) clearTimeout(this.configTimeout);

    this.configTimeout = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.ifPolygonValid(() => {
          this.recalculateFlightPath();
          requestAnimationFrame(() => this.renderAll());
        });
      });
    }, 120); 
  }

  // --- MAP CORE (MAPBOX 3D UPGRADE) ---
private initMap() {
    // We pass the token directly INSIDE the map settings to avoid Angular errors!
    this.map = new mapboxgl.Map({
      accessToken: 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA',
      container: 'map', // Matches the <div id="map"> in your HTML
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [10.1815, 36.8065], // Default: Tunis
      zoom: 15,
      pitch: 60, // 3D Camera Tilt
      bearing: -20, // 3D Camera Rotation
      antialias: true
    });

    this.map.on('load', () => {
      // Add 3D Terrain
      this.map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.2 });

      // Setup GeoJSON Sources for drawing the Grid/Polygon
      this.map.addSource('mission-polygon', { type: 'geojson', data: this.getEmptyGeoJSON() });
      this.map.addSource('mission-path', { type: 'geojson', data: this.getEmptyGeoJSON() });

      // Add Polygon Layers
      this.map.addLayer({
        id: 'polygon-fill', type: 'fill', source: 'mission-polygon',
        paint: { 'fill-color': '#2dd36f', 'fill-opacity': 0.15 }
      });
      this.map.addLayer({
        id: 'polygon-outline', type: 'line', source: 'mission-polygon',
        paint: { 'line-color': '#2dd36f', 'line-width': 3 }
      });

      // Add Flight Path Layer
      this.map.addLayer({
        id: 'flight-path-line', type: 'line', source: 'mission-path',
        paint: { 'line-color': '#181b3c', 'line-width': 3, 'line-dasharray': [3, 3] }
      });

      this.isMapLayerReady = true;

      // Fit bounds if mission already has points
      if (this.currentMission?.polygonPoints.length) {
        const bounds = new mapboxgl.LngLatBounds();
        this.currentMission.polygonPoints.forEach(p => bounds.extend([p.lng, p.lat]));
        this.map.fitBounds(bounds, { padding: 40, animate: false });
      }

      this.renderAll();

      this.zone.run(() => {
        this.isReady.set(true);
        this.cdr.detectChanges();
      });
    });

    // Map Click Listener
    this.map.on('click', (e) => {
      this.zone.run(() => {
        if (this.isDrawing() && this.currentMission) {
          // Note: Mapbox uses LngLat, Turf uses LngLat, Leaflet used LatLng. 
          this.currentMission.polygonPoints.push({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          this.ifPolygonValid(() => this.recalculateFlightPath());
          this.renderAll();
          this.updateSignal();
        }
      });
    });
  }

  private renderAll() {
    if (!this.map || !this.currentMission || !this.isMapLayerReady || this.isRendering) return;
    this.isRendering = true;

    // Clean markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    const points = this.currentMission.polygonPoints;

    if (points.length > 0) {
      // 1. Draw Polygon (Mapbox requires the first point to be repeated at the end to close the shape)
      const coords = points.map(p => [p.lng, p.lat]);
      if (coords.length >= 3) {
        const closedCoords = [...coords, coords[0]];
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource)
          .setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closedCoords] }, properties: {} });
      } else {
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      }

      // 2. Draw Markers
      points.forEach((p, idx) => this.addVertexMarker(p, idx));
      if (points.length >= 2) this.addGhostMarkers(points);

      // 3. Draw Flight Path
      this.renderFlightPath();
    } else {
      // Clear Map if empty
      (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      (this.map.getSource('mission-path') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
    }
    
    this.isRendering = false;
    this.cdr.detectChanges();
  }

  private addVertexMarker(p: Waypoint, index: number) {
    const el = document.createElement('div');
    el.style.cssText = 'background:#fff; width:16px; height:16px; border-radius:50%; border:3px solid #2dd36f; box-shadow:0 0 4px rgba(0,0,0,0.5); cursor:pointer;';

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([p.lng, p.lat])
      .addTo(this.map);

    marker.on('dragend', () => {
      this.zone.run(() => {
        if (!this.currentMission) return;
        const lngLat = marker.getLngLat();
        this.currentMission.polygonPoints[index] = { lat: lngLat.lat, lng: lngLat.lng };
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
      
      const el = document.createElement('div');
      el.style.cssText = 'background:#fff; width:12px; height:12px; border-radius:50%; border:2px solid #2dd36f; opacity:0.5; cursor:pointer;';

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([mid.lng, mid.lat])
        .addTo(this.map);

      marker.on('dragend', () => {
        this.zone.run(() => {
          if (!this.currentMission) return;
          const lngLat = marker.getLngLat();
          this.currentMission.polygonPoints.splice(i + 1, 0, { lat: lngLat.lat, lng: lngLat.lng });
          this.recalculateFlightPath();
          this.renderAll();
          this.updateSignal();
        });
      });
      this.markers.push(marker);
    }
  }

  private renderFlightPath() {
    const path = this.currentMission?.flightPath;
    if (!path || path.length === 0) {
      (this.map.getSource('mission-path') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      return;
    }

    const coords = path.map(p => [p.lng, p.lat]);
    (this.map.getSource('mission-path') as mapboxgl.GeoJSONSource)
      .setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
  }

  recalculateFlightPath() {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) {
      // Your Turf.js logic inside MissionService remains exactly the same!
      this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    }
  }

  private updateSignal() {
    if (this.currentMission) {
      this.mission.set({ ...this.currentMission }); 
      this.cdr.markForCheck();
    }
  }

  // Helper to empty out map lines
  private getEmptyGeoJSON(): any {
    return { type: 'FeatureCollection', features: [] };
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
    const withHeight = window.confirm('Include flight altitude in saved coordinates?\nOK = With Height  |  Cancel = Without Height');
    this.zone.run(() => this.executeSave(withHeight));
  }

  private executeSave(includeHeight: boolean) {
    this.isSaving.set(true);

    try {
      // 1. Safely clone the payload
      const missionPayload = JSON.parse(JSON.stringify(this.currentMission));
      
      const flightAltitude = missionPayload.config?.altitude || 0;

      // 2. Format Polygon Points
      if (missionPayload.polygonPoints) {
        missionPayload.polygonPoints = missionPayload.polygonPoints.map((p: any) => {
          return includeHeight 
            ? { lat: p.lat, lng: p.lng, alt: flightAltitude } 
            : { lat: p.lat, lng: p.lng };
        });
      }

      // 3. Format Flight Path (Check whatever your array is actually called!)
      if (missionPayload.waypoints) {
        missionPayload.waypoints = missionPayload.waypoints.map((wp: any) => {
          return includeHeight 
            ? { lat: wp.lat, lng: wp.lng, alt: flightAltitude } 
            : { lat: wp.lat, lng: wp.lng };
        });
      }
      
      // If your path is called 'flightPath', uncomment this:
      
      if (missionPayload.flightPath) {
        missionPayload.flightPath = missionPayload.flightPath.map((wp: any) => {
          return includeHeight 
            ? { lat: wp.lat, lng: wp.lng, alt: flightAltitude } 
            : { lat: wp.lat, lng: wp.lng };
        });
      }
      

      // 4. Send to database
      this.missionService.saveMission(missionPayload).subscribe({
        next: (response) => {
          console.log('Server response:', response);
          this.isSaving.set(false);
          this.router.navigate(['/home']);
        },
        error: (e: any) => {
          console.error('Server rejected the save:', e);
          this.isSaving.set(false); // Stop loading on server error
        }
      });

    } catch (err) {
      // THIS catches local crashes before they reach the server!
      console.error('CRASH in formatting data:', err);
      this.isSaving.set(false); // Stop loading on local crash
    }
  }
  

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }
  finishDrawing() { this.isDrawing.set(false); }
  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  }
  private ifPolygonValid(fn: () => void) {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) fn();
  }
  toggle3DMode() {
    this.is3DMode.set(!this.is3DMode());
    if (!this.map) return;

    if (this.is3DMode()) {
      // Smoothly animate back to 3D tilted view
      this.map.easeTo({ pitch: 60, bearing: -20, duration: 1000 });
      this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.2 });
    } else {
      // Smoothly animate to flat 2D top-down view
      this.map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      this.map.setTerrain(null as any); // Removes the 3D bumpiness
    }
  }
}