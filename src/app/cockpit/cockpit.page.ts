  import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { IonicModule, ToastController } from '@ionic/angular';
  import { Router } from '@angular/router';
  import { Subscription } from 'rxjs';
  import { MqttService } from '../services/Mqtt.service';
  import { addIcons } from 'ionicons';
  import {
    radioOutline, navigateOutline, batteryHalfOutline,
    speedometerOutline, compassOutline, locationOutline,
    stopCircleOutline, rocketOutline, arrowUpOutline,
    arrowDownOutline, homeOutline, pauseOutline,
    checkmarkCircleOutline, closeCircleOutline,
    paperPlaneOutline, searchOutline, mapOutline,
    wifiOutline, hardwareChipOutline, powerOutline,
    chevronDownOutline, chevronUpOutline, locateOutline, cubeOutline,
  } from 'ionicons/icons';
  import mapboxgl from 'mapbox-gl';

  @Component({
    selector: 'app-cockpit',
    templateUrl: './cockpit.page.html',
    styleUrls: ['./cockpit.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, FormsModule]
  })
  export class CockpitPage implements OnInit, OnDestroy {
    ngAfterViewInit() {
    // Wait a tiny bit for Ionic's lifecycle to paint the DOM
    setTimeout(() => {
      this.initMap();
    }, 500);
  }
    drone: any = null;

    // ── Connection ────────────────────────────────────────
    isConnected = false;
    droneOnline = false;
    lastSeen: string | null = null;

    // ── Telemetry ─────────────────────────────────────────
    telemetry = {
      lat: null as number | null,
      lng: null as number | null,
      altitude: 0,
      speed: 0,
      heading: 0,
      battery: 0,
      signal_strength: 0
    };

    // ── Flight state ──────────────────────────────────────
    flightState = 'IDLE';

    // ── Live Map ──────────────────────────────────────────
    isMapOpen = true;
    map3D = false;

    // Full route polygon — received ONCE from status topic when mission starts.
    // Stored here so if the map is opened mid-flight, we can draw it immediately.
    missionPolygon: { lat: number; lng: number }[] = [];

    // Progress tracking — updated by both status topic (waypoint events)
    // and telemetry topic (every ~3 s) so the progress line stays smooth.
    currentWaypointIndex = 0;
    totalWaypoints = 0;

    private map: mapboxgl.Map | null = null;
    private droneMarker: mapboxgl.Marker | null = null;
    private mapInitialized = false;
    private readonly MAPBOX_TOKEN = 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA';

    // ── Subscriptions ─────────────────────────────────────
    private subs: Subscription[] = [];
    private droneOnlineTimer: any;

    constructor(
      private router: Router,
      private mqttService: MqttService,
      private toastCtrl: ToastController,
      private zone: NgZone
    ) {
      addIcons({
        radioOutline, navigateOutline, batteryHalfOutline,
        speedometerOutline, compassOutline, locationOutline,
        stopCircleOutline, rocketOutline, arrowUpOutline,
        arrowDownOutline, homeOutline, pauseOutline,
        checkmarkCircleOutline, closeCircleOutline,
        paperPlaneOutline, searchOutline, mapOutline,
        wifiOutline, hardwareChipOutline, powerOutline,
        chevronDownOutline, chevronUpOutline, locateOutline, cubeOutline,
      });

      // ── Drone persistence fix (same pattern as sd-manager) ──────────
      const nav = this.router.currentNavigation();
      const fromNav = nav?.extras?.state?.['drone'];
      if (fromNav) {
        this.drone = fromNav;
        sessionStorage.setItem('cockpit_drone', JSON.stringify(fromNav));
      } else {
        const cached = sessionStorage.getItem('cockpit_drone');
        this.drone = cached ? JSON.parse(cached) : null;
      }
    }

    ngOnInit() {
      if (!this.drone) { this.router.navigateByUrl('/drone-manager'); return; }
      this.connectMqtt();
    }

    ngOnDestroy() {
      this.subs.forEach(s => s.unsubscribe());
      clearTimeout(this.droneOnlineTimer);
      this.mqttService.disconnect();
      if (this.map) { this.map.remove(); this.map = null; }
      sessionStorage.removeItem('cockpit_drone');
    }

    // ── MQTT ──────────────────────────────────────────────
    connectMqtt() {
      this.mqttService.connect();
      this.subs.push(
        this.mqttService.isConnected$.subscribe(connected => {
          this.zone.run(() => {
            this.isConnected = connected;
            if (connected) this.subscribeToTopics();
          });
        })
      );
    }

    subscribeToTopics() {
      const id = this.drone.id;

      // ── Telemetry topic ──────────────────────────────────────────────
      // ESP now also sends current_index + total_points here every ~3 s.
      // We use those to advance the progress line between waypoint events.
      this.subs.push(
        this.mqttService.subscribeTo(this.mqttService.telemetryTopic(id)).subscribe((data: any) => {
          this.zone.run(() => {
            // Core telemetry fields
            Object.assign(this.telemetry, {
              lat:             data.lat             ?? this.telemetry.lat,
              lng:             data.lng             ?? this.telemetry.lng,
              altitude:        data.altitude        ?? this.telemetry.altitude,
              speed:           data.speed           ?? this.telemetry.speed,
              heading:         data.heading         ?? this.telemetry.heading,
              battery:         data.battery         ?? this.telemetry.battery,
              signal_strength: data.signal_strength ?? this.telemetry.signal_strength,
            });

            // Progress fields piggybacked on telemetry
            if (data.current_index !== undefined) this.currentWaypointIndex = data.current_index;
            if (data.total_points  !== undefined) this.totalWaypoints       = data.total_points;

            // Drone online heartbeat
            this.droneOnline = true;
            this.lastSeen = new Date().toLocaleTimeString();
            clearTimeout(this.droneOnlineTimer);
            this.droneOnlineTimer = setTimeout(() => {
              this.zone.run(() => { this.droneOnline = false; });
            }, 10000);

            // Update map marker position + rotation
            this.updateDroneMarker();

            // If we already have the polygon, also refresh the progress line
            if (this.missionPolygon.length >= 2) {
              this.updateWaypointProgress();
            }
          });
        })
      );

      // ── Status topic ─────────────────────────────────────────────────
      // On mission start the ESP sends the full polygon ONCE in this topic.
      // Subsequent updates contain only state + current_index (no polygon).
      this.subs.push(
        this.mqttService.subscribeTo(this.mqttService.statusTopic(id)).subscribe((data: any) => {
          this.zone.run(() => {
            if (data.state) this.flightState = data.state;

            // Full polygon — only present in the first FLYING publish
            if (data.polygon && Array.isArray(data.polygon) && data.polygon.length >= 3) {
              this.missionPolygon = data.polygon;

              // If map is already open, render the route immediately.
              // If map is still closed, renderMissionPolygon() is called
              // inside initMap() when the user opens it.
              if (this.mapInitialized) {
                this.renderMissionPolygon();
              }
            }

            // Progress update (present in every status publish)
            if (data.current_index !== undefined) {
              this.currentWaypointIndex = data.current_index;
              if (this.mapInitialized) this.updateWaypointProgress();
            }
            if (data.total_points !== undefined) {
              this.totalWaypoints = data.total_points;
            }

            // Clear polygon when mission ends
            if (data.state === 'IDLE' || data.state === 'ABORTED') {
              this.missionPolygon      = [];
              this.currentWaypointIndex = 0;
              this.totalWaypoints       = 0;
              if (this.mapInitialized) this.clearMapLayers();
            }
          });
        })
      );
    }

    // ── Commands ──────────────────────────────────────────
    sendCommand(command: string) {
      if (!this.isConnected) { this.showToast('Not connected to broker', 'warning'); return; }
      this.mqttService.sendCommand(this.drone.id, command);
      this.showToast(`Command sent: ${command}`, 'primary');
    }

    emergencyStop() {
      if (!this.isConnected) { this.showToast('Not connected', 'danger'); return; }
      this.mqttService.sendCommand(this.drone.id, 'ABORT');
      this.showToast('Emergency STOP sent!', 'danger');
    }

    // ── Live Map ──────────────────────────────────────────
    toggleMapPanel() {
      this.isMapOpen = !this.isMapOpen;
      if (this.isMapOpen) {
        setTimeout(() => {
          this.zone.runOutsideAngular(() => {
            if (!this.mapInitialized) this.initMap();
            else this.map?.resize();
          });
        }, 320);
      }
    }

    private initMap() {
      (mapboxgl as any).accessToken = this.MAPBOX_TOKEN;

      this.map = new mapboxgl.Map({
        container: 'cockpit-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [
          this.telemetry.lng ?? 10.1815,
          this.telemetry.lat ?? 36.8065
        ],
        zoom: 16,
        pitch: 0,
        bearing: 0,
        antialias: true
      });

      this.map.on('load', () => {
        this.zone.runOutsideAngular(() => {

          // Terrain source for 3D toggle
          this.map!.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512, maxzoom: 14
          });

          // ── Full mission polygon ──────────────────────────────────
          this.map!.addSource('mission-polygon', {
            type: 'geojson',
            data: this.emptyFC()
          });
          this.map!.addLayer({
            id: 'mission-fill', type: 'fill', source: 'mission-polygon',
            paint: { 'fill-color': '#5b8cff', 'fill-opacity': 0.12 }
          });
          this.map!.addLayer({
            id: 'mission-outline', type: 'line', source: 'mission-polygon',
            paint: { 'line-color': '#5b8cff', 'line-width': 2.5, 'line-dasharray': [3, 2] }
          });

          // ── Waypoint markers (dots at each waypoint) ──────────────
          this.map!.addSource('waypoint-dots', {
            type: 'geojson',
            data: this.emptyFC()
          });
          this.map!.addLayer({
            id: 'waypoint-dots-layer',
            type: 'circle',
            source: 'waypoint-dots',
            paint: {
              'circle-radius': 4,
              'circle-color': '#5b8cff',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff'
            }
          });

          // ── Progress path (done portion in bright cyan) ───────────
          this.map!.addSource('progress-path', {
            type: 'geojson',
            data: this.emptyFC()
          });
          this.map!.addLayer({
            id: 'progress-line', type: 'line', source: 'progress-path',
            paint: { 'line-color': '#00e5ff', 'line-width': 3, 'line-opacity': 0.9 }
          });

          // ── Current target waypoint highlight ─────────────────────
          this.map!.addSource('current-waypoint', {
            type: 'geojson',
            data: this.emptyFC()
          });
          this.map!.addLayer({
            id: 'current-waypoint-layer',
            type: 'circle',
            source: 'current-waypoint',
            paint: {
              'circle-radius': 8,
              'circle-color': '#00e5ff',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.9
            }
          });

          // ── Drone marker ──────────────────────────────────────────
          const el = document.createElement('div');
          el.className = 'drone-map-marker';
          el.innerHTML = `
          <div class="drone-pulse"></div>
          <div class="drone-icon">
          <svg viewBox="0 0 24 24">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
          </div>`;

          this.droneMarker = new mapboxgl.Marker({ element: el, anchor: 'center' });

          if (this.telemetry.lat !== null && this.telemetry.lng !== null) {
            this.droneMarker.setLngLat([this.telemetry.lng!, this.telemetry.lat!]).addTo(this.map!);
          }

          this.mapInitialized = true;

          // Render any polygon + progress already received before map opened
          if (this.missionPolygon.length >= 3) {
            this.renderMissionPolygon();
            this.updateWaypointProgress();
          }
        });
      });
    }

    // Draw the full mission route + all waypoint dots.
    // Called once when polygon arrives (or when map is opened mid-mission).
    private renderMissionPolygon() {
      if (!this.mapInitialized || !this.map || this.missionPolygon.length < 3) return;
      this.zone.runOutsideAngular(() => {
        const coords = this.missionPolygon.map(p => [p.lng, p.lat]);

        // Polygon fill + outline
        (this.map!.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
          properties: {}
        });

        // Waypoint dots
        const dotFeatures = this.missionPolygon.map((p, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: { index: i }
        }));
        (this.map!.getSource('waypoint-dots') as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: dotFeatures
        });

        // Fit map to the polygon bounding box
        const bounds = new mapboxgl.LngLatBounds();
        this.missionPolygon.forEach(p => bounds.extend([p.lng, p.lat]));
        this.map!.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 800 });

        // Draw progress from whatever index we're already at
        this.updateWaypointProgress();
      });
    }

    // Update the cyan progress line and the current-target highlight circle.
    // Called on every waypoint event AND on every telemetry tick.
    private updateWaypointProgress() {
      if (!this.mapInitialized || !this.map) return;
      if (this.missionPolygon.length < 2) return;

      this.zone.runOutsideAngular(() => {
        const idx = Math.min(this.currentWaypointIndex, this.missionPolygon.length - 1);

        // Progress line: from waypoint 0 → current index
        const done = this.missionPolygon
          .slice(0, idx + 1)
          .map(p => [p.lng, p.lat]);

        (this.map!.getSource('progress-path') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: done },
          properties: {}
        });

        // Current target highlight
        const target = this.missionPolygon[idx];
        (this.map!.getSource('current-waypoint') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [target.lng, target.lat] },
          properties: {}
        });
      });
    }

    // Clear all mission layers when flight ends
    private clearMapLayers() {
      if (!this.mapInitialized || !this.map) return;
      this.zone.runOutsideAngular(() => {
        (this.map!.getSource('mission-polygon')  as mapboxgl.GeoJSONSource).setData(this.emptyFC());
        (this.map!.getSource('waypoint-dots')    as mapboxgl.GeoJSONSource).setData(this.emptyFC());
        (this.map!.getSource('progress-path')    as mapboxgl.GeoJSONSource).setData(this.emptyFC());
        (this.map!.getSource('current-waypoint') as mapboxgl.GeoJSONSource).setData(this.emptyFC());
      });
    }

    private updateDroneMarker() {
      if (!this.mapInitialized || !this.map || !this.droneMarker) return;
      if (this.telemetry.lat === null || this.telemetry.lng === null) return;

      this.zone.runOutsideAngular(() => {
        const ll: mapboxgl.LngLatLike = [this.telemetry.lng!, this.telemetry.lat!];

        if (!this.droneMarker!.getLngLat) {
          this.droneMarker!.setLngLat(ll).addTo(this.map!);
        } else {
          this.droneMarker!.setLngLat(ll);
        }

        const el   = this.droneMarker!.getElement();
        const icon = el.querySelector('.drone-icon') as HTMLElement;
        if (icon) icon.style.transform = `rotate(${this.telemetry.heading}deg)`;
      });
    }

    centerMapOnDrone() {
      if (!this.map || this.telemetry.lat === null) return;
      this.map.flyTo({
        center: [this.telemetry.lng!, this.telemetry.lat!],
        zoom: 17, duration: 1000
      });
    }

    toggleMap3D() {
      if (!this.map) return;
      this.map3D = !this.map3D;
      if (this.map3D) {
        this.map.easeTo({ pitch: 55, bearing: -20, duration: 800 });
        this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
      } else {
        this.map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
        this.map.setTerrain(null as any);
      }
    }

    private emptyFC(): any { return { type: 'FeatureCollection', features: [] }; }

    // ── Helpers ───────────────────────────────────────────
    get batteryColor(): string {
      if (this.telemetry.battery > 50) return 'success';
      if (this.telemetry.battery > 20) return 'warning';
      return 'danger';
    }

    get headingLabel(): string {
      const h = this.telemetry.heading;
      if (h >= 337.5 || h < 22.5)  return 'N';
      if (h < 67.5)  return 'NE';
      if (h < 112.5) return 'E';
      if (h < 157.5) return 'SE';
      if (h < 202.5) return 'S';
      if (h < 247.5) return 'SW';
      if (h < 292.5) return 'W';
      return 'NW';
    }

    get flightStateColor(): string {
      switch (this.flightState) {
        case 'FLYING':    return 'primary';
        case 'ARMED':     return 'warning';
        case 'RETURNING': return 'tertiary';
        case 'LANDING':   return 'warning';
        case 'LANDED':    return 'success';
        default:          return 'medium';
      }
    }

    getStatusClass(status: string): string {
      switch (status?.toLowerCase()) {
        case 'ready':   return 'ready';
        case 'pending': return 'pending';
        case 'draft':   return 'draft';
        case 'done':    return 'done';
        default:        return 'draft';
      }
    }

    async showToast(message: string, color: string) {
      const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
      toast.present();
    }
  }