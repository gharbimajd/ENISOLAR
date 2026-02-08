import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonicModule } from '@ionic/angular';

// 1. Import addIcons
import { addIcons } from 'ionicons';

// 2. Import EVERY icon used in the ENTIRE APP
import { 
  // Base Menu Icons
  homeOutline, 
  mapOutline, 
  albumsOutline, 
  settingsOutline, 
  planetOutline,

  // Action Icons (Home Page / General)
  play,   // <--- Added back
  stop,   // <--- Added back (just in case)

  // Map Planner UI - Top/Stats
  menuOutline,
  resizeOutline,
  navigateOutline,
  timeOutline,
  trendingUpOutline,
  eyeOutline,

  // Sidebar / Configuration
  chevronForwardOutline,
  chevronBackOutline,
  arrowUpOutline,
  speedometerOutline,
  compassOutline,
  layersOutline,
  swapHorizontalOutline,
  cameraOutline,

  // Action Buttons / Bottom Bar
  arrowUndoOutline,
  trashOutline,
  checkmarkDoneOutline,
  saveOutline,
  informationCircleOutline

} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, RouterLinkActive],
})
export class AppComponent {
  public appPages = [
    { title: 'Home', url: '/home', icon: 'home-outline' },
    { title: 'Map Planner', url: '/map-planner', icon: 'map-outline' },
    { title: 'Missions', url: '/mission-status', icon: 'albums-outline' },
    
  ];

  constructor() {
    // 3. Register ALL of them globally
    addIcons({ 
      // Base Menu
      'home-outline': homeOutline, 
      'map-outline': mapOutline, 
      'albums-outline': albumsOutline, 
      'settings-outline': settingsOutline, 
      'planet-outline': planetOutline,

      // Actions (Home/Global)
      play,
      stop,

      // Map Planner - Stats & Top
      'menu-outline': menuOutline,
      'resize-outline': resizeOutline,
      'navigate-outline': navigateOutline,
      'time-outline': timeOutline,
      'trending-up-outline': trendingUpOutline,
      'eye-outline': eyeOutline,

      // Sidebar & Config
      'chevron-forward-outline': chevronForwardOutline,
      'chevron-back-outline': chevronBackOutline,
      'arrow-up-outline': arrowUpOutline,
      'speedometer-outline': speedometerOutline,
      'compass-outline': compassOutline,
      'layers-outline': layersOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'camera-outline': cameraOutline,

      // Actions & Info
      'arrow-undo-outline': arrowUndoOutline,
      'trash-outline': trashOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'save-outline': saveOutline,
      'information-circle-outline': informationCircleOutline
    });
  }
}