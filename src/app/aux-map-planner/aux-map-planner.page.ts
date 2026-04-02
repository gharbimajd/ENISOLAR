import {
  Component, OnDestroy, signal, ChangeDetectorRef,HostListener, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';


import {
  IonContent,
  IonSpinner, IonIcon, IonInput, IonRange,
} from '@ionic/angular/standalone';

import { ViewWillEnter, ViewDidEnter } from '@ionic/angular';

import * as mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

import { addIcons } from 'ionicons';
import {
  optionsOutline, chevronDownOutline, arrowUndoOutline, trashOutline,
  saveOutline, airplaneOutline, locateOutline, settingsOutline,
  arrowBack, arrowUp, speedometer, layers, compass, camera,
  resizeOutline, timeOutline, navigateOutline, eyeOutline,
  checkmarkDoneOutline, cubeOutline, mapOutline, gridOutline
} from 'ionicons/icons';

import { Mission, Waypoint } from '../models/mission.model';
import { MissionService } from 'src/app/services/mission';

export type FlightMode = 'matrix' | 'linear';

@Component({
  selector: 'app-aux-map-planner',
  templateUrl: './aux-map-planner.page.html',
  styleUrls: ['./aux-map-planner.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent,
    IonSpinner, IonIcon, IonInput, IonRange,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuxMapPlannerPage implements ViewWillEnter, ViewDidEnter, OnDestroy {

  // ── Signals ────────────────────────────────────────────────────────────────
  mission      = signal<Mission | null>(null);
  isDrawing    = signal(true);
  sidebarOpen  = signal(true);
  isSaving     = signal(false);
  isReady      = signal(false);
  is3DMode     = signal(true);
  flightMode   = signal<FlightMode>('matrix');
  matrixPoints = signal<Waypoint[]>([]);

  // Matrix cell spacing in metres
  matrixSpacingX = 20;
  matrixSpacingY = 20;

  // ── Internal ───────────────────────────────────────────────────────────────
  private map!: mapboxgl.Map;
  protected currentMission: Mission | null = null;
  private markers:      mapboxgl.Marker[] = [];
  private configTimeout: any;
  private isRendering     = false;
  private isMapLayerReady = false;

  private readonly SRC_POLYGON = 'mission-polygon';
  private readonly SRC_GRID    = 'mission-grid';
  private readonly SRC_PATH    = 'mission-path';

  constructor(
    private route:           ActivatedRoute,
    protected router:        Router,
    private missionService:  MissionService,
    private zone:            NgZone,
    private cdr:             ChangeDetectorRef,
  ) {
    addIcons({
      'options-outline': optionsOutline, 'chevron-down-outline': chevronDownOutline,
      'arrow-undo-outline': arrowUndoOutline, 'trash-outline': trashOutline,
      'save-outline': saveOutline, 'airplane-outline': airplaneOutline,
      'locate-outline': locateOutline, 'settings-outline': settingsOutline,
      'arrow-back': arrowBack, 'arrow-up': arrowUp, 'speedometer': speedometer,
      'layers': layers, 'compass': compass, 'camera': camera,
      'resize-outline': resizeOutline, 'time-outline': timeOutline,
      'navigate-outline': navigateOutline, 'eye-outline': eyeOutline,
      'checkmark-done-outline': checkmarkDoneOutline, 'cube-outline': cubeOutline,
      'map-outline': mapOutline, 'grid-outline': gridOutline
    });
  }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────

  ionViewWillEnter() {
    this.isReady.set(false);
    const id   = this.route.snapshot.paramMap.get('id');
    const mode = (this.route.snapshot.queryParamMap.get('mode') as FlightMode) || 'matrix';
    this.flightMode.set(mode);

    if (id && id !== 'new') {
      this.missionService.getMissionById(id).subscribe(loaded => {
        this.currentMission = loaded || this.createFreshMission();
        this.mission.set(this.currentMission);
        this.isDrawing.set((this.currentMission?.polygonPoints?.length || 0) < 3);
        this.cdr.markForCheck();
      });
    } else {
      this.currentMission = this.createFreshMission();
      this.mission.set(this.currentMission);
      this.isDrawing.set(true);
    }
  }

  async ionViewDidEnter() {
    await new Promise(r => setTimeout(r, 60));
    this.zone.runOutsideAngular(() => {
      if (!this.map) this.initMap();
      else this.map.resize();
    });
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }

  // ── MODE ───────────────────────────────────────────────────────────────────

  setMode(mode: FlightMode) {
    this.flightMode.set(mode);
    this.recalculate();
    this.renderAll();
  }

  // ── CONFIG ─────────────────────────────────────────────────────────────────

  onConfigChange()       { this.updateSignal(); this.debounceRecalc(); }
  onMatrixSpacingChange() { this.debounceRecalc(); }

  private debounceRecalc() {
    if (this.configTimeout) clearTimeout(this.configTimeout);
    this.configTimeout = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.ifPolygonValid(() => {
          this.recalculate();
          requestAnimationFrame(() => this.renderAll());
        });
      });
    }, 120);
  }

  // ── MAP INIT ───────────────────────────────────────────────────────────────

  private initMap() {
    this.map = new mapboxgl.Map({
      accessToken: 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA',
      container: 'aux-map',
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [10.1815, 36.8065],
      zoom: 15, pitch: 60, bearing: -20, antialias: true
    });

    this.map.on('load', () => {
      this.map.addSource('mapbox-dem', {
        type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512, maxzoom: 14
      });
      this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });

      this.map.addSource(this.SRC_POLYGON, { type: 'geojson', data: this.emptyFC() });
      this.map.addSource(this.SRC_GRID,    { type: 'geojson', data: this.emptyFC() });
      this.map.addSource(this.SRC_PATH,    { type: 'geojson', data: this.emptyFC() });

      // Polygon
      this.map.addLayer({ id: 'polygon-fill', type: 'fill', source: this.SRC_POLYGON,
        paint: { 'fill-color': '#5b8cff', 'fill-opacity': 0.12 } });
      this.map.addLayer({ id: 'polygon-outline', type: 'line', source: this.SRC_POLYGON,
        paint: { 'line-color': '#5b8cff', 'line-width': 2.5 } });

      // Matrix grid lines (H + V, clipped to polygon)
      this.map.addLayer({ id: 'matrix-grid-lines', type: 'line', source: this.SRC_GRID,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#ff6b35', 'line-width': 0.8, 'line-opacity': 0.6 } });

      // Matrix cell-centre dots (the actual saved waypoints)
      this.map.addLayer({ id: 'matrix-grid-dots', type: 'circle', source: this.SRC_GRID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 3.5, 'circle-color': '#ff6b35',
          'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(255,255,255,0.85)',
          'circle-opacity': 0.9
        }});

      // Linear perimeter dashed line
      this.map.addLayer({ id: 'linear-path-line', type: 'line', source: this.SRC_PATH,
        paint: { 'line-color': '#00e5ff', 'line-width': 2.2, 'line-dasharray': [4, 3] } });

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

      // On mobile the Mapbox canvas sits on top of everything and swallows
      // touch events. We dynamically toggle pointer-events so buttons work.
      this.updateCanvasPointerEvents();
    });

    this.map.on('click', (e) => {
      this.zone.run(() => {
        if (this.isDrawing() && this.currentMission) {
          this.currentMission.polygonPoints.push({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          this.ifPolygonValid(() => this.recalculate());
          this.renderAll();
          this.updateSignal();
        }
      });
    });
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  private renderAll() {
    if (!this.map || !this.currentMission || !this.isMapLayerReady || this.isRendering) return;
    this.isRendering = true;
    this.clearMarkers();

    const pts = this.currentMission.polygonPoints;

    if (pts.length > 0) {
      const coords = pts.map(p => [p.lng, p.lat]);

      if (coords.length >= 3) {
        this.setGeoJSON(this.SRC_POLYGON, {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
          properties: {}
        });
      } else {
        this.setGeoJSON(this.SRC_POLYGON, this.emptyFC());
      }

      pts.forEach((p, i) => this.addVertexMarker(p, i));
      if (pts.length >= 2) this.addGhostMarkers(pts);

      if (this.flightMode() === 'matrix') {
        this.renderMatrixGrid();
        this.setGeoJSON(this.SRC_PATH, this.emptyFC());
      } else {
        this.renderLinearPerimeter();
        this.setGeoJSON(this.SRC_GRID, this.emptyFC());
      }
    } else {
      this.setGeoJSON(this.SRC_POLYGON, this.emptyFC());
      this.setGeoJSON(this.SRC_GRID,    this.emptyFC());
      this.setGeoJSON(this.SRC_PATH,    this.emptyFC());
    }

    this.isRendering = false;
    this.cdr.detectChanges();
  }

  /** MATRIX — clipped H+V grid lines + cell-centre dots pushed to one GeoJSON source */
  private renderMatrixGrid() {
    const pts = this.currentMission?.polygonPoints;
    if (!pts || pts.length < 3) { this.setGeoJSON(this.SRC_GRID, this.emptyFC()); return; }

    const coords  = pts.map(p => [p.lng, p.lat]);
    const polygon = turf.polygon([[...coords, coords[0]]]);
    const bbox    = turf.bbox(polygon);
    const midLat  = (bbox[1] + bbox[3]) / 2;
    const dLat    = this.matrixSpacingY / 111320;
    const dLng    = this.matrixSpacingX / (111320 * Math.cos(midLat * Math.PI / 180));

    const features: any[] = [];

    // Clip a line to polygon by finding the two intersection points,
    // then drawing a segment only between them (inside the polygon).
    const clipLineToPoly = (line: any): [number, number][] | null => {
      const hits = turf.lineIntersect(line, polygon);
      if (hits.features.length < 2) return null;
      const sorted = hits.features
        .map((f: any) => f.geometry.coordinates as [number, number])
        .sort((a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1]);
      return [sorted[0], sorted[sorted.length - 1]];
    };

    // Horizontal lines
    for (let lat = bbox[1]; lat <= bbox[3] + dLat; lat += dLat) {
      const line = turf.lineString([[bbox[0] - 0.001, lat], [bbox[2] + 0.001, lat]]);
      const seg  = clipLineToPoly(line);
      if (seg) features.push(turf.lineString(seg));
    }

    // Vertical lines
    for (let lng = bbox[0]; lng <= bbox[2] + dLng; lng += dLng) {
      const line = turf.lineString([[lng, bbox[1] - 0.001], [lng, bbox[3] + 0.001]]);
      const seg  = clipLineToPoly(line);
      if (seg) features.push(turf.lineString(seg));
    }

    // Cell-centre dots (flight waypoints)
    this.matrixPoints().forEach(p => features.push(turf.point([p.lng, p.lat])));

    this.setGeoJSON(this.SRC_GRID, { type: 'FeatureCollection', features });
  }

  /** LINEAR — polygon boundary = flight path, shown as closed dashed perimeter */
  private renderLinearPerimeter() {
    const pts = this.currentMission?.polygonPoints;
    if (!pts || pts.length < 2) { this.setGeoJSON(this.SRC_PATH, this.emptyFC()); return; }
    const coords = [...pts.map(p => [p.lng, p.lat]), [pts[0].lng, pts[0].lat]];
    this.setGeoJSON(this.SRC_PATH, {
      type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {}
    });
  }

  // ── RECALCULATE ────────────────────────────────────────────────────────────

  private recalculate() {
    if (!this.currentMission || this.currentMission.polygonPoints.length < 3) return;
    this.flightMode() === 'matrix' ? this.calcMatrixCentres() : this.calcLinearPerimeter();
  }

  /** Snake-ordered cell centres (offset half cell from grid origin) */
  private calcMatrixCentres() {
    if (!this.currentMission) return;
    const pts     = this.currentMission.polygonPoints;
    const coords  = pts.map(p => [p.lng, p.lat]);
    const polygon = turf.polygon([[...coords, coords[0]]]);
    const bbox    = turf.bbox(polygon);
    const midLat  = (bbox[1] + bbox[3]) / 2;
    const dLat    = this.matrixSpacingY / 111320;
    const dLng    = this.matrixSpacingX / (111320 * Math.cos(midLat * Math.PI / 180));

    const result: Waypoint[] = [];
    let row = 0;

    for (let lat = bbox[1] + dLat / 2; lat < bbox[3]; lat += dLat) {
      const rowLngs: number[] = [];
      for (let lng = bbox[0] + dLng / 2; lng < bbox[2]; lng += dLng) {
        if (turf.booleanPointInPolygon(turf.point([lng, lat]), polygon)) rowLngs.push(lng);
      }
      if (row % 2 !== 0) rowLngs.reverse();
      rowLngs.forEach(lng => result.push({ lat, lng }));
      row++;
    }

    this.matrixPoints.set(result);
    this.currentMission.flightPath    = result;
    this.currentMission.waypointCount = result.length;
    this.updateSignal();
  }

  /** Linear: polygon boundary vertices = flight path, no interior strips */
  private calcLinearPerimeter() {
    if (!this.currentMission) return;
    const path = [...this.currentMission.polygonPoints];
    this.currentMission.flightPath    = path;
    this.currentMission.waypointCount = path.length;
    this.updateSignal();
  }

  // ── MARKERS ────────────────────────────────────────────────────────────────

  private addVertexMarker(p: Waypoint, index: number) {
    const el = document.createElement('div');
    el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #5b8cff;box-shadow:0 0 4px rgba(0,0,0,.5);cursor:pointer;';
    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([p.lng, p.lat]).addTo(this.map);
    marker.on('dragend', () => {
      this.zone.run(() => {
        if (!this.currentMission) return;
        const ll = marker.getLngLat();
        this.currentMission.polygonPoints[index] = { lat: ll.lat, lng: ll.lng };
        this.recalculate(); this.renderAll(); this.updateSignal();
      });
    });
    this.markers.push(marker);
  }

  private addGhostMarkers(points: Waypoint[]) {
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const mid  = { lat: (curr.lat + next.lat) / 2, lng: (curr.lng + next.lng) / 2 };
      const el   = document.createElement('div');
      el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #5b8cff;opacity:.5;cursor:pointer;';
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([mid.lng, mid.lat]).addTo(this.map);
      marker.on('dragend', () => {
        this.zone.run(() => {
          if (!this.currentMission) return;
          const ll = marker.getLngLat();
          this.currentMission.polygonPoints.splice(i + 1, 0, { lat: ll.lat, lng: ll.lng });
          this.recalculate(); this.renderAll(); this.updateSignal();
        });
      });
      this.markers.push(marker);
    }
  }

  private clearMarkers() { this.markers.forEach(m => m.remove()); this.markers = []; }

  // ── UTILS ──────────────────────────────────────────────────────────────────

  private setGeoJSON(id: string, data: any) {
    (this.map.getSource(id) as mapboxgl.GeoJSONSource).setData(data);
  }
  private emptyFC(): any { return { type: 'FeatureCollection', features: [] }; }
  private ifPolygonValid(fn: () => void) {
    if (this.currentMission && this.currentMission.polygonPoints.length >= 3) fn();
  }
  private updateSignal() {
    if (this.currentMission) { this.mission.set({ ...this.currentMission }); this.cdr.markForCheck(); }
  }

  // ID is generated server-side by save_mL.php (modulo-3 system)
  // Matrix: id % 3 === 1  →  1, 4, 7 ...
  // Linear: id % 3 === 2  →  2, 5, 8 ...

  private createFreshMission(): Mission {
    return {
      id: `draft_${Date.now()}`,
      user_id: localStorage.getItem('user_id') || '',
      name: '', status: 'Draft', date: new Date(),
      areaSize: 0, totalDistance: 0, estimatedTime: 0, waypointCount: 0, gsd: 0,
      polygonPoints: [], flightPath: [],
      config: {
        altitude: 60, speed: 10, gridAngle: 0, overlapFront: 80, overlapSide: 70,
        orientationMode: 'CourseAligned',
        camera: {
          modelName: 'DJI Mini 3 Pro', sensorWidth: 9.6, sensorHeight: 7.2,
          focalLength: 6.72, imageWidth: 4032, imageHeight: 3024
        }
      }
    };
  }

  // ── ACTIONS ────────────────────────────────────────────────────────────────

  undoLastPoint() {
    if (!this.currentMission?.polygonPoints.length) return;
    this.currentMission.polygonPoints.pop();
    if (this.currentMission.polygonPoints.length < 3) {
      this.currentMission.flightPath = []; this.matrixPoints.set([]);
      this.isDrawing.set(true);
      this.updateCanvasPointerEvents();
    } else { this.recalculate(); }
    this.renderAll(); this.updateSignal();
  }

  clearPolygon() {
    if (!this.currentMission) return;
    this.currentMission.polygonPoints = [];
    this.currentMission.flightPath    = [];
    this.matrixPoints.set([]);
    this.isDrawing.set(true);
    this.updateCanvasPointerEvents();
    this.renderAll(); this.updateSignal();
  }

  updateMissionName(name: string) {
    if (this.currentMission) { this.currentMission.name = name; this.updateSignal(); }
  }

  toggleSidebar() { this.sidebarOpen.set(!this.sidebarOpen()); }

  finishDrawing() {
    this.isDrawing.set(false);
    this.updateCanvasPointerEvents();
  }

  formatTime(s: number): string { return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`; }

  /**
   * When drawing: map canvas needs pointer events to register taps as polygon points.
   * When not drawing: disable canvas pointer events so buttons on top can be tapped.
   */
  private updateCanvasPointerEvents() {
    if (!this.map) return;
    const canvas = this.map.getCanvas();
    canvas.style.pointerEvents = this.isDrawing() ? 'auto' : 'none';
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

  // ── SAVE ───────────────────────────────────────────────────────────────────

  saveMission() {
    if (!this.currentMission || this.isSaving()) return;
    // Use native window.confirm — works on browser AND Capacitor Android/iOS
    const withHeight = window.confirm('Include flight altitude in saved coordinates?\nOK = With Height  |  Cancel = Without Height');
    this.zone.run(() => this.executeSave(withHeight));
  }

  private executeSave(includeHeight: boolean) {
    if (!this.currentMission) return;
    this.isSaving.set(true);
    try {
      const mode    = this.flightMode();
      const payload = JSON.parse(JSON.stringify(this.currentMission));
      const alt     = payload.config?.altitude || 0;

      // ID is generated server-side by save_mL.php (modulo-3 system)
      // Just send missionType so PHP knows which slot to use
      payload.missionType = mode === 'matrix' ? 'M' : 'L';

      const mapPt = (p: any) =>
        includeHeight ? { lat: p.lat, lng: p.lng, alt } : { lat: p.lat, lng: p.lng };

      payload.polygonPoints = (payload.polygonPoints ?? []).map(mapPt);
      payload.flightPath    = (payload.flightPath    ?? []).map(mapPt);

      // saveMissionML() added to MissionService → hits save_mL.php
      this.missionService.saveMissionML(payload).subscribe({
        next:  () => { this.isSaving.set(false); this.router.navigate(['/home']); },
        error: (e: any) => { console.error(e); this.isSaving.set(false); }
      });
    } catch (err) {
      console.error(err);
      this.isSaving.set(false);
    }
  }
  get isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

@HostListener('window:resize')
onResize() {}
  isSheetOpen   = true;   // portrait bottom sheet
isSidebarOpen = true;   // landscape sidebar
 
// ─── SWIPE-TO-CLOSE (portrait bottom sheet) ───────────────────
private _touchStartY = 0;
private _touchDeltaY = 0;
 
onSheetTouchStart(e: TouchEvent): void {
  this._touchStartY = e.touches[0].clientY;
  this._touchDeltaY = 0;
}
 
onSheetTouchMove(e: TouchEvent): void {
  this._touchDeltaY = e.touches[0].clientY - this._touchStartY;
}
 
onSheetTouchEnd(_e: TouchEvent): void {
  // Swipe down ≥ 60px → collapse
  if (this._touchDeltaY > 60) {
    this.isSheetOpen = false;
  }
  this._touchDeltaY = 0;
}
}