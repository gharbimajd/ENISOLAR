// src/app/models/mission.model.ts

// Hardware definitions
export interface CameraSpecs {
  modelName: string;
  sensorWidth: number;   // mm
  sensorHeight: number;  // mm
  focalLength: number;   // mm
  imageWidth: number;    // px
  imageHeight: number;   // px
}

// === ADD THIS EXPORT ===
export interface Waypoint {
  lat: number;
  lng: number;
}

// Predefined camera configurations
export const CAMERA_PRESETS: CameraSpecs[] = [
  {
    modelName: 'DJI Phantom 4 Pro',
    sensorWidth: 13.2,
    sensorHeight: 8.8,
    focalLength: 8.8,
    imageWidth: 5472,
    imageHeight: 3648
  },
  {
    modelName: 'DJI Mavic 3',
    sensorWidth: 17.3,
    sensorHeight: 13,
    focalLength: 24,
    imageWidth: 5280,
    imageHeight: 3956
  },
  {
    modelName: 'Autel EVO II Pro',
    sensorWidth: 13.2,
    sensorHeight: 8.8,
    focalLength: 9,
    imageWidth: 5472,
    imageHeight: 3648
  }
];

// User Configuration
export interface FlightConfig {
  altitude: number;      // meters (Default: 60)
  speed: number;         // m/s (Default: 10)
  overlapFront: number;  // % (Default: 80)
  overlapSide: number;   // % (Default: 70)
  gridAngle: number;     // degrees (0-360)
  camera: CameraSpecs;   // Selected camera
  orientationMode: 'CourseAligned' | 'NorthAligned';
}

// The Mission Object
export interface Mission {
  id: string;
  user_id: string;
  name: string;
  date: Date;
  status: 'Draft' | 'Ready' | 'Flyable';
  
  // GEOMETRY - Updated to use Waypoint
  polygonPoints: Waypoint[]; 
  flightPath: Waypoint[]; 
  
  // STATS
  totalDistance: number; // meters
  estimatedTime: number; // seconds
  areaSize: number;      // hectares
  gsd: number;           // cm/px
  waypointCount: number; // count
  
  config: FlightConfig;
}

// Default flight configuration
export const DEFAULT_FLIGHT_CONFIG: FlightConfig = {
  altitude: 60,
  speed: 10,
  overlapFront: 80,
  overlapSide: 70,
  gridAngle: 0,
  camera: CAMERA_PRESETS[0],
  orientationMode: 'CourseAligned'
};

// Helper to create a new mission
export function createNewMission(name?: string): Mission {
  return {
    id: generateId(),
    user_id:getCurrentUserId(),
    name: name || `Mission ${new Date().toLocaleDateString()}`,
    date: new Date(),
    status: 'Draft',
    polygonPoints: [],
    flightPath: [],
    totalDistance: 0,
    estimatedTime: 0,
    areaSize: 0,
    gsd: 0,
    waypointCount: 0,
    config: { ...DEFAULT_FLIGHT_CONFIG }
  };
}

function generateId(): string {
  return `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
 function getCurrentUserId(): string {
    return localStorage.getItem('user_id') || '';
  }