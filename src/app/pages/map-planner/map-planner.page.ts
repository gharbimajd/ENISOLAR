import { 
  Component, OnDestroy, signal, ChangeDetectorRef, NgZone, 
  ChangeDetectionStrategy, HostListener 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// Only keeping the ionic elements that are actually used in the HTML template
import { 
  IonContent, IonSpinner, IonIcon, IonInput, IonRange 
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';

// --- NEW 3D MAP ENGINE ---
import * as mapboxgl from 'mapbox-gl';

import { addIcons } from 'ionicons'; 
import { 
  optionsOutline, chevronDownOutline, chevronUpOutline, chevronBackOutline, chevronForwardOutline,
  arrowUndoOutline, trashOutline, saveOutline, airplaneOutline, locateOutline, settingsOutline,
  arrowBack, arrowUp, speedometer, layers, compass, camera,
  resizeOutline, timeOutline, navigateOutline, eyeOutline, checkmarkDoneOutline,
  cubeOutline, mapOutline
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
    IonContent, IonSpinner, IonIcon, IonInput, IonRange, 
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {
  // --- State Signals ---
  mission = signal<Mission | null>(null);
  isDrawing = signal(true);
  isSaving = signal(false); 
  isReady = signal(false); 
  is3DMode = signal(true);
  
  // --- Layout States ---
  isSheetOpen   = true; 
  isSidebarOpen = true; 

  // --- Internal State ---
  private map!: mapboxgl.Map;
  private currentMission: Mission | null = null;
  private markers: mapboxgl.Marker[] = [];
  private configTimeout: any;
  private isRendering = false;
  private isMapLayerReady = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private missionService: MissionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
   addIcons({ 
      'options-outline': optionsOutline, 
      'chevron-down-outline': chevronDownOutline,
      'chevron-up-outline': chevronUpOutline,
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
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

  // --- RESPONSIVE LAYOUT LOGIC ---
  get isLandscape(): boolean {
    return window.innerWidth > window.innerHeight;
  }

  @HostListener('window:resize')
  onResize() {}

  // --- SWIPE-TO-CLOSE (portrait bottom sheet) ---
  private _touchStartY = 0;
  private _touchDeltaY = 0;
  
  onSheetTouchStart(e: TouchEvent) {
    this._touchStartY = e.touches[0].clientY;
    this._touchDeltaY = 0;
  }
  onSheetTouchMove(e: TouchEvent) {
    this._touchDeltaY = e.touches[0].clientY - this._touchStartY;
  }
  onSheetTouchEnd(e: TouchEvent) {
    if (this._touchDeltaY > 40) {
      this.isSheetOpen = false;
    } else if (this._touchDeltaY < -40) {
      this.isSheetOpen = true;
    }
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

  // --- MAP CORE (MAPBOX 3D) ---
  private initMap() {
    this.map = new mapboxgl.Map({
      accessToken: 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA',
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [10.1815, 36.8065], 
      zoom: 15,
      pitch: 60, 
      bearing: -20, 
      antialias: true
    });

    this.map.on('load', () => {
      this.map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.2 });

      this.map.addSource('mission-polygon', { type: 'geojson', data: this.getEmptyGeoJSON() });
      this.map.addSource('mission-path', { type: 'geojson', data: this.getEmptyGeoJSON() });

      this.map.addLayer({
        id: 'polygon-fill', type: 'fill', source: 'mission-polygon',
        paint: { 'fill-color': '#2dd36f', 'fill-opacity': 0.15 }
      });
      this.map.addLayer({
        id: 'polygon-outline', type: 'line', source: 'mission-polygon',
        paint: { 'line-color': '#2dd36f', 'line-width': 3 }
      });

      this.map.addLayer({
        id: 'flight-path-line', type: 'line', source: 'mission-path',
        paint: { 'line-color': '#181b3c', 'line-width': 3, 'line-dasharray': [3, 3] }
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

  private renderAll() {
    if (!this.map || !this.currentMission || !this.isMapLayerReady || this.isRendering) return;
    this.isRendering = true;

    this.markers.forEach(m => m.remove());
    this.markers = [];

    const points = this.currentMission.polygonPoints;

    if (points.length > 0) {
      const coords = points.map(p => [p.lng, p.lat]);
      if (coords.length >= 3) {
        const closedCoords = [...coords, coords[0]];
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource)
          .setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closedCoords] }, properties: {} });
      } else {
        (this.map.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData(this.getEmptyGeoJSON());
      }

      points.forEach((p, idx) => this.addVertexMarker(p, idx));
      if (points.length >= 2) this.addGhostMarkers(points);

      this.renderFlightPath();
    } else {
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
      this.currentMission = this.missionService.generateFlightPath(this.currentMission);
    }
  }

  private updateSignal() {
    if (this.currentMission) {
      this.mission.set({ ...this.currentMission }); 
      this.cdr.markForCheck();
    }
  }

  private getEmptyGeoJSON(): any {
    return { type: 'FeatureCollection', features: [] };
  }

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

showSaveWidget: boolean = false;

  // 2. Replace your OLD saveMission() with this NEW one
  saveMission() {
    if (!this.currentMission || this.isSaving()) return;
    
    // Instead of window.confirm, this just flips the switch to show our custom HTML widget!
    this.showSaveWidget = !this.showSaveWidget;
  }



  // 3. The function attached to the "With Height" / "Without Height" widget buttons
  executeSaveChoice(withHeight: boolean) {
    this.showSaveWidget = false; // Hides the widget
    this.zone.run(() => this.executeSave(withHeight)); // Runs your saving logic
  }

  // 4. Your exact saving logic (untouched)
  private executeSave(includeHeight: boolean) {
    this.isSaving.set(true);

    try {
      const missionPayload = JSON.parse(JSON.stringify(this.currentMission));
      const flightAltitude = missionPayload.config?.altitude || 0;

      if (missionPayload.polygonPoints) {
        missionPayload.polygonPoints = missionPayload.polygonPoints.map((p: any) => {
          return includeHeight 
            ? { lat: p.lat, lng: p.lng, alt: flightAltitude } 
            : { lat: p.lat, lng: p.lng };
        });
      }

      if (missionPayload.waypoints) {
        missionPayload.waypoints = missionPayload.waypoints.map((wp: any) => {
          return includeHeight 
            ? { lat: wp.lat, lng: wp.lng, alt: flightAltitude } 
            : { lat: wp.lat, lng: wp.lng };
        });
      }
      
      if (missionPayload.flightPath) {
        missionPayload.flightPath = missionPayload.flightPath.map((wp: any) => {
          return includeHeight 
            ? { lat: wp.lat, lng: wp.lng, alt: flightAltitude } 
            : { lat: wp.lat, lng: wp.lng };
        });
      }
      
      this.missionService.saveMission(missionPayload).subscribe({
        next: (response) => {
          console.log('Server response:', response);
          this.isSaving.set(false);
          this.router.navigate(['/home']);
        },
        error: (e: any) => {
          console.error('Server rejected the save:', e);
          this.isSaving.set(false); 
        }
      });

    } catch (err) {
      console.error('CRASH in formatting data:', err);
      this.isSaving.set(false); 
    }
  }
  
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
      this.map.easeTo({ pitch: 60, bearing: -20, duration: 1000 });
      this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.2 });
    } else {
      this.map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      this.map.setTerrain(null as any);
    }
  }
}