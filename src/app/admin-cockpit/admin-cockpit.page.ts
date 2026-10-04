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
  chevronDownOutline, chevronUpOutline, locateOutline,
  cubeOutline, expandOutline, warningOutline,
  cameraOutline, playOutline, stopOutline,
} from 'ionicons/icons';
import mapboxgl from 'mapbox-gl';

@Component({
  selector: 'app-admin-cockpit',
  templateUrl: './admin-cockpit.page.html',
  styleUrls: ['./admin-cockpit.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class AdminCockpitPage implements OnInit, OnDestroy {

  ngAfterViewInit() {
    setTimeout(() => { this.initMap(); }, 500);
  }

  drone: any = null;

  // ── Connection ────────────────────────────────────────
  isConnected  = false;
  droneOnline  = false;
  lastSeen: string | null = null;

  // ── Telemetry ─────────────────────────────────────────
  telemetry = {
    lat:             0 as number,
    lng:             0 as number,
    altitude:        0,
    speed:           0,
    heading:         0,
    battery:         0,
    signal_strength: 0
  };

  gpsFixed     = false;
  homePointSet = false;
  flightState  = 'IDLE';

  // ── Tabs ──────────────────────────────────────────────
  activeTab: 'flight' | 'camera' = 'flight';

  // ── Camera / Stream ───────────────────────────────────
  streamActive    = false;
  camOnline       = false;
  currentFps      = 0;
  camStreamUrl:   string | null = null;   // set dynamically from MQTT
  streamImgUrl:   string | null = null;   // actual src bound to <img>

  private frameCount    = 0;
  private fpsInterval:  any = null;
  private camStatusSub: Subscription | null = null;
  private fpsTimer:     any = null;

  // ── Map ───────────────────────────────────────────────
  map3D = false;
  missionPolygon: { lat: number; lng: number }[] = [];
  currentWaypointIndex = 0;
  totalWaypoints       = 0;

  private map:            mapboxgl.Map    | null = null;
  private droneMarker:    mapboxgl.Marker | null = null;
  private mapInitialized = false;
  private readonly MAPBOX_TOKEN = 'pk.eyJ1IjoibWFqZDU1IiwiYSI6ImNtbTEzZ3U2ODA0b3cycHF6YnRjNmNudmoifQ.K7vd07Ug7vwq5hkDRawtQA';

  // ── Subscriptions ─────────────────────────────────────
  private subs: Subscription[] = [];
  private droneOnlineTimer: any;

  constructor(
    private router:    Router,
    private mqttService: MqttService,
    private toastCtrl: ToastController,
    private zone:      NgZone
  ) {
    addIcons({
      radioOutline, navigateOutline, batteryHalfOutline,
      speedometerOutline, compassOutline, locationOutline,
      stopCircleOutline, rocketOutline, arrowUpOutline,
      arrowDownOutline, homeOutline, pauseOutline,
      checkmarkCircleOutline, closeCircleOutline,
      paperPlaneOutline, searchOutline, mapOutline,
      wifiOutline, hardwareChipOutline, powerOutline,
      chevronDownOutline, chevronUpOutline, locateOutline,
      cubeOutline, expandOutline, warningOutline,
      cameraOutline, playOutline, stopOutline,
    });

    const nav     = this.router.currentNavigation();
    const fromNav = nav?.extras?.state?.['drone'];
    if (fromNav) {
      this.drone = fromNav;
      sessionStorage.setItem('admin_cockpit_drone', JSON.stringify(fromNav));
    } else {
      const cached = sessionStorage.getItem('admin_cockpit_drone');
      this.drone   = cached ? JSON.parse(cached) : null;
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
    this.stopStream();
  }

  onBackNav() {
    sessionStorage.removeItem('admin_cockpit_drone');
    this.router.navigateByUrl('/drone-manager');
  }

  // ── Tab switching ─────────────────────────────────────
  setTab(tab: 'flight' | 'camera') {
    this.activeTab = tab;
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

    // Telemetry
    this.subs.push(
      this.mqttService.subscribeTo(this.mqttService.telemetryTopic(id)).subscribe((data: any) => {
        this.zone.run(() => {
          const hasValidPos = data.lat !== undefined &&
                              data.lng !== undefined &&
                              !(data.lat === 0 && data.lng === 0);
          if (hasValidPos) {
            this.gpsFixed      = true;
            this.telemetry.lat = data.lat;
            this.telemetry.lng = data.lng;
          }

          this.telemetry.altitude        = data.altitude        ?? this.telemetry.altitude;
          this.telemetry.speed           = data.speed           ?? this.telemetry.speed;
          this.telemetry.heading         = data.heading         ?? this.telemetry.heading;
          this.telemetry.battery         = data.battery         ?? this.telemetry.battery;
          this.telemetry.signal_strength = data.signal_strength ?? this.telemetry.signal_strength;

          if (data.current_index !== undefined) this.currentWaypointIndex = data.current_index;
          if (data.total_points  !== undefined) this.totalWaypoints       = data.total_points;

          this.droneOnline = true;
          this.lastSeen    = new Date().toLocaleTimeString();
          clearTimeout(this.droneOnlineTimer);
          this.droneOnlineTimer = setTimeout(() => {
            this.zone.run(() => { this.droneOnline = false; });
          }, 15000);

          if (this.gpsFixed) this.updateDroneMarker();
          if (this.missionPolygon.length >= 2) this.updateWaypointProgress();
        });
      })
    );

    // Status
    this.subs.push(
      this.mqttService.subscribeTo(this.mqttService.statusTopic(id)).subscribe((data: any) => {
        this.zone.run(() => {
          if (data.state === 'HOME_SET') { this.homePointSet = true; return; }
          if (data.state === 'GPS_LOST') { this.gpsFixed = false; return; }
          if (data.state) this.flightState = data.state;

          if (data.polygon && Array.isArray(data.polygon) && data.polygon.length >= 3) {
            this.missionPolygon = data.polygon;
            if (this.mapInitialized) this.renderMissionPolygon();
          }

          if (data.current_index !== undefined) {
            this.currentWaypointIndex = data.current_index;
            if (this.mapInitialized) this.updateWaypointProgress();
          }
          if (data.total_points !== undefined) this.totalWaypoints = data.total_points;

          if (data.state === 'IDLE' || data.state === 'ABORTED') {
            this.missionPolygon       = [];
            this.currentWaypointIndex = 0;
            this.totalWaypoints       = 0;
            if (this.mapInitialized) this.clearMapLayers();
          }
        });
      })
    );

    // Camera status topic — drone/{id}/cam/status
    // CAM publishes: { state: 'READY', husarnet_ip: 'fc94:xxxx:...' }
    const camStatusTopic = `drone/${id}/cam/status`;
    this.camStatusSub = this.mqttService.subscribeTo(camStatusTopic).subscribe((data: any) => {
      this.zone.run(() => {
        if (data.husarnet_ip) {
          // Build MJPEG stream URL from Husarnet IPv6 address
          this.camStreamUrl = `http://[${data.husarnet_ip}]:8080/stream`;
          this.camOnline    = true;
          console.log('[CAM] Stream URL:', this.camStreamUrl);
        }
        if (data.state === 'OFFLINE') {
          this.camOnline    = false;
          this.camStreamUrl = null;
          this.stopStream();
        }
      });
    });
    this.subs.push(this.camStatusSub);
  }

  // ── Commands ──────────────────────────────────────────
  sendCommand(command: string) {
    if (!this.isConnected) { this.showToast('Not connected to broker', 'warning'); return; }
    if (command === 'RTH' && !this.homePointSet) {
      this.showToast('RTH unavailable — home point not set', 'warning');
      return;
    }
    this.mqttService.sendCommand(this.drone.id, command);
    this.showToast(`Command sent: ${command}`, 'primary');
  }

  emergencyStop() {
    if (!this.isConnected) { this.showToast('Not connected', 'danger'); return; }
    this.mqttService.sendCommand(this.drone.id, 'LAND');
    this.showToast('Emergency LAND sent!', 'danger');
  }

  // ── Camera stream ─────────────────────────────────────
  // Husarnet gives the CAM a permanent IPv6 address.
  // The CAM runs a native MJPEG HTTP server on port 8080.
  // The app just points an <img> src at it — browser handles
  // the MJPEG stream natively. No WebSocket, no relay, no base64.

  toggleStream() {
    if (this.streamActive) {
      this.stopStream();
    } else {
      this.startStream();
    }
  }

  startStream() {
    if (!this.camOnline || !this.camStreamUrl) {
      this.showToast('Camera not ready', 'warning');
      return;
    }

    // Notify CAM via MQTT to start (wake up stream server if sleeping)
    if (this.isConnected) {
      this.mqttService.publish(
        `drone/${this.drone.id}/cam/stream/start`,
        JSON.stringify({ command: 'START_STREAM' })
      );
    }

    // Set img src — browser opens MJPEG stream directly to CAM via Husarnet
    // Add timestamp to bust any cache
    this.streamImgUrl = `${this.camStreamUrl}?t=${Date.now()}`;
    this.streamActive = true;
    this.startFpsCounter();
  }

  stopStream() {
    this.streamActive  = false;
    this.streamImgUrl  = null;
    this.stopFpsCounter();

    // Notify CAM to stop streaming (saves CAM power/bandwidth)
    if (this.isConnected && this.drone) {
      this.mqttService.publish(
        `drone/${this.drone.id}/cam/stream/stop`,
        JSON.stringify({ command: 'STOP_STREAM' })
      );
    }
  }

  // Called from template on each img load event to count fps
  onFrameLoad() {
    this.frameCount++;
  }

  private startFpsCounter() {
    this.frameCount = 0;
    this.fpsInterval = setInterval(() => {
      this.zone.run(() => {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
      });
    }, 1000);
  }

  private stopFpsCounter() {
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    this.currentFps = 0;
    this.frameCount = 0;
  }

  // ── Map ───────────────────────────────────────────────
  private initMap() {
    (mapboxgl as any).accessToken = this.MAPBOX_TOKEN;

    this.map = new mapboxgl.Map({
      container: 'admin-cockpit-map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [
        this.gpsFixed ? this.telemetry.lng : 10.1815,
        this.gpsFixed ? this.telemetry.lat : 36.8065
      ],
      zoom: 16,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    this.map.on('load', () => {
      this.zone.runOutsideAngular(() => {

        this.map!.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512, maxzoom: 14
        });

        this.map!.addSource('mission-polygon', { type: 'geojson', data: this.emptyFC() });
        this.map!.addLayer({
          id: 'mission-fill', type: 'fill', source: 'mission-polygon',
          paint: { 'fill-color': '#5b8cff', 'fill-opacity': 0.12 }
        });
        this.map!.addLayer({
          id: 'mission-outline', type: 'line', source: 'mission-polygon',
          paint: { 'line-color': '#5b8cff', 'line-width': 2.5, 'line-dasharray': [3, 2] }
        });

        this.map!.addSource('waypoint-dots', { type: 'geojson', data: this.emptyFC() });
        this.map!.addLayer({
          id: 'waypoint-dots-layer', type: 'circle', source: 'waypoint-dots',
          paint: {
            'circle-radius': 4, 'circle-color': '#5b8cff',
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff'
          }
        });

        this.map!.addSource('progress-path', { type: 'geojson', data: this.emptyFC() });
        this.map!.addLayer({
          id: 'progress-line', type: 'line', source: 'progress-path',
          paint: { 'line-color': '#00e5ff', 'line-width': 3, 'line-opacity': 0.9 }
        });

        this.map!.addSource('current-waypoint', { type: 'geojson', data: this.emptyFC() });
        this.map!.addLayer({
          id: 'current-waypoint-layer', type: 'circle', source: 'current-waypoint',
          paint: {
            'circle-radius': 8, 'circle-color': '#00e5ff',
            'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

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

        if (this.gpsFixed) {
          this.droneMarker.setLngLat([this.telemetry.lng, this.telemetry.lat]).addTo(this.map!);
        }

        this.mapInitialized = true;

        if (this.missionPolygon.length >= 3) {
          this.renderMissionPolygon();
          this.updateWaypointProgress();
        }
      });
    });
  }

  private renderMissionPolygon() {
    if (!this.mapInitialized || !this.map || this.missionPolygon.length < 3) return;
    this.zone.runOutsideAngular(() => {
      const coords = this.missionPolygon.map(p => [p.lng, p.lat]);

      (this.map!.getSource('mission-polygon') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
        properties: {}
      });

      const dotFeatures = this.missionPolygon.map((p, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { index: i }
      }));
      (this.map!.getSource('waypoint-dots') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection', features: dotFeatures
      });

      const bounds = new mapboxgl.LngLatBounds();
      this.missionPolygon.forEach(p => bounds.extend([p.lng, p.lat]));
      if (this.gpsFixed) bounds.extend([this.telemetry.lng, this.telemetry.lat]);
      this.map!.fitBounds(bounds, { padding: 80, maxZoom: 18, duration: 800 });

      this.updateWaypointProgress();
    });
  }

  private updateWaypointProgress() {
    if (!this.mapInitialized || !this.map) return;
    if (this.missionPolygon.length < 2) return;

    this.zone.runOutsideAngular(() => {
      const idx  = Math.min(this.currentWaypointIndex, this.missionPolygon.length - 1);
      const done = this.missionPolygon.slice(0, idx + 1).map(p => [p.lng, p.lat]);

      (this.map!.getSource('progress-path') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: done },
        properties: {}
      });

      const target = this.missionPolygon[idx];
      (this.map!.getSource('current-waypoint') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [target.lng, target.lat] },
        properties: {}
      });
    });
  }

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
    if (!this.gpsFixed) return;

    this.zone.runOutsideAngular(() => {
      const ll: mapboxgl.LngLatLike = [this.telemetry.lng, this.telemetry.lat];
      try {
        this.droneMarker!.getLngLat();
        this.droneMarker!.setLngLat(ll);
      } catch {
        this.droneMarker!.setLngLat(ll).addTo(this.map!);
      }

      const icon = this.droneMarker!.getElement().querySelector('.drone-icon') as HTMLElement;
      if (icon) icon.style.transform = `rotate(${this.telemetry.heading}deg)`;
    });
  }

  centerMapOnDrone() {
    if (!this.map || !this.gpsFixed) return;
    this.map.flyTo({ center: [this.telemetry.lng, this.telemetry.lat], zoom: 17, duration: 1000 });
  }

  fitAll() {
    if (!this.map) return;
    const bounds = new mapboxgl.LngLatBounds();
    if (this.gpsFixed) bounds.extend([this.telemetry.lng, this.telemetry.lat]);
    this.missionPolygon.forEach(p => bounds.extend([p.lng, p.lat]));
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: 80, maxZoom: 18, duration: 800 });
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
      case 'FLYING':  return 'primary';
      case 'ARMED':   return 'warning';
      case 'RTH':     return 'tertiary';
      case 'LANDING': return 'warning';
      case 'LANDED':  return 'success';
      case 'ABORTED': return 'danger';
      default:        return 'medium';
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 2500, color, position: 'bottom'
    });
    toast.present();
  }
}