import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

// 1. CHANGE: Import UI components from '@ionic/angular/standalone'
// DO NOT use 'IonicModule' here.
import { 
  IonApp,
  IonRouterOutlet,
  IonMenu,         // <--- The magic fixer
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle    // <--- Required for the menu logic
} from '@ionic/angular/standalone';

// 2. Import addIcons
import { addIcons } from 'ionicons';

// 3. Import Icons
import { 
  homeOutline, 
  mapOutline, 
  albumsOutline, 
  settingsOutline, 
  planetOutline,
  play, 
  stop, 
  menuOutline,
  resizeOutline,
  navigateOutline,
  timeOutline,
  trendingUpOutline,
  eyeOutline,
  chevronForwardOutline,
  chevronBackOutline,
  arrowUpOutline,
  speedometerOutline,
  compassOutline,
  layersOutline,
  swapHorizontalOutline,
  cameraOutline,
  arrowUndoOutline,
  trashOutline,
  checkmarkDoneOutline,
  saveOutline,
  informationCircleOutline,
  logInOutline,
  personCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  // 4. CHANGE: Register the specific components here
  imports: [
    CommonModule, 
    RouterLink, 
    RouterLinkActive,
    IonApp,           // Required
    IonRouterOutlet,  // Required
    IonMenu,          // <--- This fixes the "stuck" menu
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle     // Required
  ],
})
export class AppComponent {
  public appPages = [
    { title: 'My Profile', url: '/profile', icon: 'person-outline' },
    { title: 'Home', url: '/home', icon: 'home-outline' },
     { title: 'Mode', url: '/mission-select', icon: 'settings-outline' },
    { title: 'Map Planner', url: '/map-planner', icon: 'map-outline' },
    { title: 'settings', url: '/settings', icon: 'settings-outline' },


  ];

  constructor() {
    // 5. Register ALL icons
    addIcons({ 
      'home-outline': homeOutline, 
      'map-outline': mapOutline, 
      'albums-outline': albumsOutline, 
      'settings-outline': settingsOutline, 
      'planet-outline': planetOutline,
      'play': play,
      'stop': stop,
      'menu-outline': menuOutline,
      'resize-outline': resizeOutline,
      'navigate-outline': navigateOutline,
      'time-outline': timeOutline,
      'trending-up-outline': trendingUpOutline,
      'eye-outline': eyeOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'chevron-back-outline': chevronBackOutline,
      'arrow-up-outline': arrowUpOutline,
      'speedometer-outline': speedometerOutline,
      'compass-outline': compassOutline,
      'layers-outline': layersOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'camera-outline': cameraOutline,
      'arrow-undo-outline': arrowUndoOutline,
      'trash-outline': trashOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'save-outline': saveOutline,
      'information-circle-outline': informationCircleOutline,
      'log-in-outline':logInOutline,
      'person-outline':personCircleOutline
    });
  }
}