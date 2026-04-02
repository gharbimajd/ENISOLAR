import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
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
  personCircleOutline,
  moonOutline,
  sunnyOutline
} from 'ionicons/icons';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle
  ],
})
export class AppComponent {
  public appPages = [
    { title: 'Home',            url: '/home',             icon: 'home-outline' },
    { title: 'My Profile',      url: '/profile',          icon: 'person-outline' },
    { title: 'New Mission',     url: '/mission-select',   icon: 'map-outline' },
    { title: 'Manage Missions', url: '/manage-missions',  icon: 'albums-outline' },
    { title: 'Settings',        url: '/settings',         icon: 'settings-outline' },
  ];

  constructor(public theme: ThemeService) {
    // Initialise theme on startup (applies saved or system preference)
    this.theme.init();

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
      'log-in-outline': logInOutline,
      'person-outline': personCircleOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline,
    });
  }
}
