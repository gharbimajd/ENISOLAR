import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs'; 
import { map, catchError } from 'rxjs/operators';
import { Mission, createNewMission, FlightConfig } from '../models/mission.model';
import * as turf from '@turf/turf';
import { Feature, LineString, Position, Polygon } from 'geojson';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root'
})
export class MissionService {
  
  private apiUrl = environment.apiUrl; 

  constructor() {} // HttpClient removed to solve the Mixed Content block
  
  /**
   * Get all missions from the Database (enisolar)
   * Modified to use CapacitorHttp to bypass HTTPS/HTTP security blocks
   */
 getMissions(): Observable<Mission[]> {
    // 1. Get the user ID from storage (or use your getCurrentUserId() helper if you prefer)
    const userId = localStorage.getItem('user_id') || '';

    return from(CapacitorHttp.get({ 
      url: `${this.apiUrl}/get_missions.php`, 
      params: { user_id: userId } 
    })).pipe(
      map((response: HttpResponse) => {
        // Safety Check 1: No data or server returned an error message
        if (!response.data || response.data.error) return [];

        const missions = response.data;

        // Safety Check 2: Make sure PHP actually sent an array back before trying to .map() it
        if (!Array.isArray(missions)) return [];

        return (missions as Mission[]).map(m => {
          // TRICK TYPESCRIPT: Force it to treat date as a string temporarily
          // This fixes "Property 'replace' does not exist"
          let dateStr = m.date as any;

          // ANDROID FIX: Replace space with 'T' if it's a string
          if (typeof dateStr === 'string') {
             dateStr = dateStr.replace(' ', 'T');
          }

          return {
            ...m,
            date: new Date(dateStr) // Now convert to real Date object
          };
        });
      }),
      catchError(error => {
        console.error('Error fetching missions:', error);
        return of([]);
      })
    );
  }

  /**
   * Get a specific mission by ID
   */
  getMissionById(id: string): Observable<Mission | undefined> {
  const userId = localStorage.getItem('user_id') || '';

  return from(CapacitorHttp.get({ 
    url: `${this.apiUrl}/get_missions.php`, 
    params: { 
      user_id: userId,
      mission_id: id // This tells PHP: "I want a specific one"
    } 
  })).pipe(
    map((response: HttpResponse) => {
      // Safety: Error from server or no data
      if (!response.data || response.data.error) return undefined;

      const m = response.data;

      // Handle the Date formatting logic just like in getMissions
      let dateStr = m.date as any;
      if (typeof dateStr === 'string') {
          dateStr = dateStr.replace(' ', 'T');
      }

      return {
        ...m,
        date: new Date(dateStr),
        // Force coordinates to arrays just in case PHP sends null
        polygonPoints: m.polygonPoints || [],
        flightPath: m.flightPath || []
      } as Mission;
    }),
    catchError(error => {
      console.error('Error fetching mission details:', error);
      return of(undefined);
    })
  );
}
  
  register(userData: any): Observable<any> {
  return from(CapacitorHttp.post({
    url: `${this.apiUrl}/register.php`,
    data: userData,
    headers: { 'Content-Type': 'application/json' }
  })).pipe(
    map(res => res.data)
  );
}
  login(credentials: any): Observable<any> {
    return from(CapacitorHttp.post({
      url: `${this.apiUrl}/login.php`,
      data: credentials,
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map(res => res.data)
    );
  }
  /**
   * Fetch User Profile Data
   */
  getProfile(): Observable<any> {
    const userId = localStorage.getItem('user_id') || '';
    
    return from(CapacitorHttp.get({
      url: `${this.apiUrl}/get_profile.php`,
      params: { user_id: userId }
    })).pipe(
      map(res => res.data)
    );
  }
  /**
   * Change User Password
   */
  changePassword(passwordData: any): Observable<any> {
    const userId = localStorage.getItem('user_id') || '';
    
    // Combine the user ID with the password payload
    const payload = {
      user_id: userId,
      ...passwordData
    };

    return from(CapacitorHttp.post({
      url: `${this.apiUrl}/change_password.php`,
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map(res => res.data)
    );
  }
  
  /**
   * Save or update a mission to the Database
   */
 saveMission(mission: Mission): Observable<any> {
    // 1. Get the user ID from storage
    const userId = localStorage.getItem('user_id') || '';

    // 2. Ensure the mission has the user_id attached before saving
    // This acts as a safety net in case the mission was somehow created without it
    if (!mission.user_id) {
      mission.user_id = userId;
    }

    return from(CapacitorHttp.post({
      url: `${this.apiUrl}/save_mission.php`,
      data: mission, // Now this definitely contains the user_id!
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map(res => res.data)
    );
  }

  /**
   * Delete a mission from the Database
   */
deleteMission(id: string): Observable<any> {
    // 1. Get the current user's ID
    const userId = localStorage.getItem('user_id') || '';

    return from(CapacitorHttp.delete({
      url: `${this.apiUrl}/delete_mission.php`,
      // 2. Send BOTH the mission id and the user_id to the server
      params: { 
        id: id,
        user_id: userId
      }
    })).pipe(
      map(res => res.data)
    );
  }
  /**
   * Create a new mission structure (Client-side factory)
   */
  createMission(name?: string): Mission {
    return createNewMission(name);
  }

  // =================================================================
  //  MATH & ALGORITHMS (PRESERVED EXACTLY AS PROVIDED)
  // =================================================================

  /**
   * Calculate Ground Sampling Distance (GSD)
   */
  private calculateGSD(config: FlightConfig): number {
    const { camera, altitude } = config;
    const gsd = (camera.sensorWidth * altitude * 100) / 
                (camera.focalLength * camera.imageWidth);
    return Math.round(gsd * 100) / 100; 
  }

  /**
   * Calculate coverage dimensions
   */
  private calculateCoverage(config: FlightConfig): { width: number; height: number } {
    const { camera, altitude } = config;
    const width = (camera.sensorWidth * altitude) / camera.focalLength;
    const height = (camera.sensorHeight * altitude) / camera.focalLength;
    return { width, height };
  }

  /**
   * THE CORE ALGORITHM: Generate the snake flight path
   */
  generateFlightPath(mission: Mission): Mission {
    // Need at least 3 points to form a polygon
    if (mission.polygonPoints.length < 3) {
      mission.flightPath = [];
      mission.totalDistance = 0;
      mission.estimatedTime = 0;
      mission.areaSize = 0;
      mission.waypointCount = 0;
      mission.gsd = this.calculateGSD(mission.config);
      return mission;
    }

    try {
      // 1. Calculate GSD
      mission.gsd = this.calculateGSD(mission.config);

      // 2. Calculate coverage and spacing
      const coverage = this.calculateCoverage(mission.config);
      
      // Spacing between lines (based on side overlap)
      const lineSpacing = coverage.width * (1 - mission.config.overlapSide / 100);
      
      // 3. Create Turf polygon from points
      const coordinates: Position[] = mission.polygonPoints.map(p => [p.lng, p.lat]);
      
      // Close the polygon if not already closed
      if (
        coordinates.length > 0 &&
        (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
         coordinates[0][1] !== coordinates[coordinates.length - 1][1])
      ) {
        coordinates.push(coordinates[0]);
      }
      
      const polygon = turf.polygon([coordinates]);

      // Calculate area in hectares
      const areaMeters = turf.area(polygon);
      mission.areaSize = Math.round(areaMeters / 10000 * 100) / 100; 

      // 4. Rotate polygon by negative angle (to align grid)
      const centroid = turf.centroid(polygon);
      const rotatedPolygon = turf.transformRotate(
        polygon, 
        -mission.config.gridAngle, 
        { pivot: centroid }
      );

      // 5. Get bounding box of rotated polygon
      const bbox = turf.bbox(rotatedPolygon);
      const [minX, minY, maxX, maxY] = bbox;

      // 6. Generate parallel lines
      const lines: Feature<LineString>[] = [];
      let currentY = minY;
      
      while (currentY <= maxY) {
        const line = turf.lineString([
          [minX - 0.001, currentY], // Extend slightly beyond bbox
          [maxX + 0.001, currentY]
        ]);
        lines.push(line);
        currentY += lineSpacing / 111320; // Convert meters to degrees (approximate)
      }

      // 7. Clip lines to polygon and create snake pattern
      const clippedSegments: Array<{lat: number, lng: number}[]> = [];
      
      for (const line of lines) {
        try {
          const intersection = turf.lineIntersect(line, rotatedPolygon);
          
          if (intersection.features.length >= 2) {
            const points: Position[] = intersection.features.map(f => f.geometry.coordinates);
            
            // Sort points by X coordinate (Longitude)
            points.sort((a, b) => a[0] - b[0]);
            
            const segment = points.map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }));
            
            clippedSegments.push(segment);
          }
        } catch (e) {
          console.warn('Line intersection error:', e);
        }
      }

      // 8. Create snake pattern (alternate direction)
      const snakePath: {lat: number, lng: number}[] = [];
      
      clippedSegments.forEach((segment, index) => {
        if (index % 2 === 0) {
          // Left to right
          snakePath.push(...segment);
        } else {
          // Right to left (reverse)
          snakePath.push(...segment.reverse());
        }
      });

      // 9. Rotate path back to original orientation
      if (snakePath.length > 0) {
        const pathCoordinates = snakePath.map(p => [p.lng, p.lat]);
        const pathLine = turf.lineString(pathCoordinates);
        const rotatedBack = turf.transformRotate(
          pathLine, 
          mission.config.gridAngle, 
          { pivot: centroid }
        );
        
        const geometry = rotatedBack.geometry as LineString;
        mission.flightPath = geometry.coordinates.map(coord => ({
          lat: coord[1],
          lng: coord[0]
        }));
      } else {
        mission.flightPath = [];
      }

      // 10. Calculate distance and time
      if (mission.flightPath.length > 1) {
        let totalDistance = 0;
        for (let i = 0; i < mission.flightPath.length - 1; i++) {
          const from = turf.point([mission.flightPath[i].lng, mission.flightPath[i].lat]);
          const to = turf.point([mission.flightPath[i + 1].lng, mission.flightPath[i + 1].lat]);
          totalDistance += turf.distance(from, to, { units: 'meters' });
        }
        
        mission.totalDistance = Math.round(totalDistance);
        mission.estimatedTime = Math.round(totalDistance / mission.config.speed);
        mission.waypointCount = mission.flightPath.length;
      }

      // 11. Update mission status
      if (mission.flightPath.length > 0) {
        mission.status = mission.status === 'Draft' ? 'Ready' : mission.status;
      }

    } catch (error) {
      console.error('Error generating flight path:', error);
      mission.flightPath = [];
    }

    return mission;
  }

  /**
   * Validate if a mission is ready to fly
   */
  validateMission(mission: Mission): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (mission.polygonPoints.length < 3) {
      errors.push('Mission requires at least 3 polygon points');
    }

    if (mission.flightPath.length === 0) {
      errors.push('Flight path has not been generated');
    }

    if (mission.config.altitude < 10 || mission.config.altitude > 120) {
      errors.push('Altitude must be between 10 and 120 meters');
    }

    if (mission.config.speed < 1 || mission.config.speed > 15) {
      errors.push('Speed must be between 1 and 15 m/s');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate estimated battery consumption
   */
  estimateBatteryCount(mission: Mission): number {
    // Assuming 20 minutes flight time per battery
    const flightTimeMinutes = mission.estimatedTime / 60;
    const batteriesNeeded = Math.ceil(flightTimeMinutes / 20);
    return Math.max(1, batteriesNeeded);
  }
  saveMissionML(mission: any): Observable<any> {
  const userId = localStorage.getItem('user_id') || '';
  if (!mission.user_id) mission.user_id = userId;
 
  return from(CapacitorHttp.post({
    url: `${this.apiUrl}/save_mL.php`,
    data: mission,
    headers: { 'Content-Type': 'application/json' }
  })).pipe(
    map(res => res.data)
  );
}
}