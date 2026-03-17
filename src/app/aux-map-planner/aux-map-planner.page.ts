import {
  Component, OnDestroy, signal, ChangeDetectorRef, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
  IonBackButton, IonSpinner, IonIcon, IonInput, IonRange, IonButton
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';

import * as mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

import { addIcons } from 'ionicons';
import {
  optionsOutline, chevronDownOutline, arrowUndoOutline, trashOutline,
  saveOutline, airplaneOutline, locateOutline, settingsOutline,
  arrowBack, arrowUp, speedometer, layers, compass, camera,
  resizeOutline, timeOutline, navigateOutline, eyeOutline, checkmarkDoneOutline,
  cubeOutline, mapOutline, gridOutline
} from 'ionicons/icons';

import { Mission, Waypoint } from '../models/mission.model';
import { MissionService } from 'src/app/services/mission';

export type FlightMode = 'matrix' | 'linear' | 'waypoints';

@Component({
  selector: 'app-aux-map-planner',
  templateUrl: './aux-map-planner.page.html',
  styleUrls: ['./aux-map-planner.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar,
    IonSpinner, IonIcon, IonInput, IonRange,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuxMapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {

  // --- Signals ---
  mission = signal<Mission | null>(null);
  isDrawing = signal(true);
  sidebarOpen = signal(true);
  isSaving = signal(false);
  isReady = signal(false);
  is3DMode = signal(true);
  flightMode = signal<FlightMode>('matrix');

  // Matrix config
  matrixSpacingX = 20; // meters horizontal
  matrixSpacingY = 20; // meters vertical

  // Matrix flight path points (dot grid)
  matrixPoints = signal<Waypoint[]>([]);

  // --- Internal ---
  private map!: mapboxgl.Map;
  protected currentMission: Mission | null = null;
  private markers: mapboxgl.Marker[] = [];
  private matrixMarkers: mapboxgl.Marker[] = [];
  private configTimeout: any;
  private isRendering = false;
  private isMapLayerReady = false;

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private alertController: AlertController,
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
      'map-outline': mapOutline,
      'grid-outline': gridOutline
    });
  }

  // --- LIFECYCLE ---
  ionViewWillEnter() {
    this.isReady.set(false);
    const id = this.route.snapshot.paramMap.get('id');

    // Read mode from query params if passed from mission-select
    const mode = (this.route.snapshot.queryParamMap.get('mode') as FlightMode) || 'matrix';
    this.flightMode.set(mode);

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
    if (this.map) this.map.remove();
  }

  // --- FLIGHT MODE ---
  setMode(mode: FlightMode) {
    this.flightMode.set(mode);
    this.recalculateFlightPath();
    this.renderAll();
  }

  // --- CONFIG ---
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

  onMatrixSpacingChange() {
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

  // --- MAP INIT ---
  private initMap() {
    this.map = new mapboxgl.Map({
      accessToken: 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA',
      container: 'aux-map',
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [10.1815, 36.8065],
      zoom: 15,
      pitch: 60,
      bearing: -20,
      antialias: true
    });

    this.map.on('load', () => {
      // 3D Terrain
      this.map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      });
      this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });

      // Sources
      this.map.addSource('mission-polygon', { type: 'geojson', data: this.getEmptyGeoJSON() });
      this.map.addSource('mission-path', { type: 'geojson', data: this.getEmptyGeoJSON() });

      // Polygon layers
      this.map.addLayer({
        id: 'polygon-fill', type: 'fill', source: 'mission-polygon',
        paint: { 'fill-color': '#5b8cff', 'fill-opacity': 0.15 }
      });
      this.map.addLayer({
        id: 'polygon-outline', type: 'line', source: 'mission-polygon',
        paint: { 'line-color': '#5b8cff', 'line-width': 3 }
      });

      // Flight path / linear layer
      this.map.addLayer({
        id: 'flight-path-line', type: 'line', source: 'mission-path',
        paint: { 'line-color': '#ff6b35', 'line-width': 2, 'line-dasharray': [3, 3] }
      });

      this.isMapLayerReady = true;

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

    // Click to add polygon points (same as original)
    this.map.on('click', (e) => {
      this.zone.run(() => {
        if (this.isDrawing() && this.currentMission) {
          this.currentMission.polygonPoints.push({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          this.ifPolygonValid(() => this.recalculateFlightPath());
          this.renderAll();
          this.updateSignal();
        }
      });
    });
  }

  // --- RENDER ---
  private renderAll() {
    if (!this.map || !this.currentMission || !this.isMapLayerReady || this.isRendering) return;
    this.isRendering = true;

    // Clear markers
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.clearMatrixMarkers();

    const points = this.currentMission.polygonPoints;

    if (points.length > 0) {
      // Draw polygon
      const coords = points.map(p => [p.lng, p.lat]);
      if (coords.length >= 3) {
        const closedCoords = [...coords, coords[0]];
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource)
          .setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closedCoords] }, properties: {} });
      } else {
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      }

      // Vertex markers
      points.forEach((p, idx) => this.addVertexMarker(p, idx));
      if (points.length >= 2) this.addGhostMarkers(points);

      // Mode-specific rendering
      if (this.flightMode() === 'matrix') {
        this.renderMatrixPoints();
        // Clear path line for matrix
        (this.map.getSource('mission-path') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      } else {
        this.renderFlightPath();
        // Clear matrix dots
        this.clearMatrixMarkers();
      }
    } else {
      (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      (this.map.getSource('mission-path') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
    }

    this.isRendering = false;
    this.cdr.detectChanges();
  }

  // --- MATRIX RENDERING ---
  private renderMatrixPoints() {
    const pts = this.matrixPoints();
    pts.forEach(p => {
      const el = document.createElement('div');
      el.className = 'matrix-dot';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(this.map);

      this.matrixMarkers.push(marker);
    });
  }

  private clearMatrixMarkers() {
    this.matrixMarkers.forEach(m => m.remove());
    this.matrixMarkers = [];
  }

  // --- FLIGHT PATH (linear/waypoints) ---
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

  // --- RECALCULATE FLIGHT PATH (MODE-AWARE) ---
  recalculateFlightPath() {
    if (!this.currentMission || this.currentMission.polygonPoints.length < 3) return;

    const mode = this.flightMode();

    if (mode === 'matrix') {
      this.calculateMatrixGrid();
    } else if (mode === 'linear') {
      this.calculateLinearPath();
    } else if (mode === 'waypoints') {
      // Waypoints = user-defined polygon vertices become the path
      this.currentMission.flightPath = [...this.currentMission.polygonPoints];
      this.updateSignal();
    }
  }

  /**
   * MATRIX MODE:
   * Generates a uniform grid of points inside the polygon.
   * Spacing is defined by matrixSpacingX (lng) and matrixSpacingY (lat) in meters.
   * These dots ARE the flight path.
   */
  private calculateMatrixGrid() {
    if (!this.currentMission) return;

    const pts = this.currentMission.polygonPoints;
    const coords = pts.map(p => [p.lng, p.lat]);
    const closedCoords = [...coords, coords[0]];
    const polygon = turf.polygon([closedCoords]);
    const bbox = turf.bbox(polygon);

    // Convert spacing meters → degrees (approximate)
    const degPerMeterLat = 1 / 111320;
    const degPerMeterLng = 1 / (111320 * Math.cos((bbox[1] + bbox[3]) / 2 * Math.PI / 180));

    const stepLat = this.matrixSpacingY * degPerMeterLat;
    const stepLng = this.matrixSpacingX * degPerMeterLng;

    const gridPoints: Waypoint[] = [];
    let row = 0;

    for (let lat = bbox[1]; lat <= bbox[3]; lat += stepLat) {
      const lngs: number[] = [];
      for (let lng = bbox[0]; lng <= bbox[2]; lng += stepLng) {
        const pt = turf.point([lng, lat]);
        if (turf.booleanPointInPolygon(pt, polygon)) {
          lngs.push(lng);
        }
      }
      // Boustrophedon (snake) ordering: alternate row direction
      if (row % 2 !== 0) lngs.reverse();
      lngs.forEach(lng => gridPoints.push({ lat, lng }));
      row++;
    }

    this.matrixPoints.set(gridPoints);
    // Also store as flightPath for saving purposes
    this.currentMission.flightPath = gridPoints;
    this.currentMission.waypointCount = gridPoints.length;
    this.updateSignal();
  }

  /**
   * LINEAR MODE:
   * Standard lawnmower/parallel strip scan using MissionService.
   */
  private calculateLinearPath() {
    if (!this.currentMission) return;
    this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    this.updateSignal();
  }

  // --- VERTEX MARKERS (same as original) ---
  private addVertexMarker(p: Waypoint, index: number) {
    const el = document.createElement('div');
    el.style.cssText = 'background:#fff; width:16px; height:16px; border-radius:50%; border:3px solid #5b8cff; box-shadow:0 0 4px rgba(0,0,0,0.5); cursor:pointer;';

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
      el.style.cssText = 'background:#fff; width:12px; height:12px; border-radius:50%; border:2px solid #5b8cff; opacity:0.5; cursor:pointer;';

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

  // --- UTILS ---
  private updateSignal() {
    if (this.currentMission) {
      this.mission.set({ ...this.currentMission });
      this.cdr.markForCheck();
    }
  }

  private getEmptyGeoJSON(): any {
    return { type: 'FeatureCollection', features: [] };
  }

  private ifPolygonValid(fn: () => void) {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) fn();
  }

  private createFreshMissionObject(): Mission {
    return {
      id: `mission_${Date.now()}`,
      user_id: localStorage.getItem('user_id') || '',
      name: '',
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

  // --- ACTIONS ---
  undoLastPoint() {
    if (!this.currentMission?.polygonPoints.length) return;
    this.currentMission.polygonPoints.pop();
    if (this.currentMission.polygonPoints.length < 3) {
      this.currentMission.flightPath = [];
      this.matrixPoints.set([]);
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
    this.matrixPoints.set([]);
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

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }
  finishDrawing() { this.isDrawing.set(false); }

  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  }

  toggle3DMode() {
    this.is3DMode.set(!this.is3DMode());
    if (!this.map) return;
    if (this.is3DMode()) {
      this.map.easeTo({ pitch: 60, bearing: -20, duration: 1000 });
      this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
    } else {
      this.map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      this.map.setTerrain(null as any);
    }
  }

  async saveMission() {
    if (!this.currentMission || this.isSaving()) return;

    const alert = await this.alertController.create({
      header: 'Save Mission',
      message: 'Include flight altitude in saved coordinates?',
      cssClass: 'glass-alert',
      buttons: [
        { text: 'Without Height', role: 'cancel', handler: () => this.executeSave(false) },
        { text: 'With Height', handler: () => this.executeSave(true) }
      ]
    });
    await alert.present();
  }

  private executeSave(includeHeight: boolean) {
    this.isSaving.set(true);
    try {
      const payload = JSON.parse(JSON.stringify(this.currentMission));
      const alt = payload.config?.altitude || 0;

      if (payload.polygonPoints) {
        payload.polygonPoints = payload.polygonPoints.map((p: any) =>
          includeHeight ? { lat: p.lat, lng: p.lng, alt } : { lat: p.lat, lng: p.lng });
      }
      if (payload.flightPath) {
        payload.flightPath = payload.flightPath.map((p: any) =>
          includeHeight ? { lat: p.lat, lng: p.lng, alt } : { lat: p.lat, lng: p.lng });
      }

      this.missionService.saveMission(payload).subscribe({
        next: () => { this.isSaving.set(false); this.router.navigate(['/home']); },
        error: (e: any) => { console.error(e); this.isSaving.set(false); }
      });
    } catch (err) {
      console.error(err);
      this.isSaving.set(false);
    }
  }
}