import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

// 1. Add the icons used in your HTML template
import { addIcons } from 'ionicons';
import { 
  scanOutline, 
  gridOutline, 
  pulseOutline, 
  locationOutline, 
  chevronBackOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-mission-select',
  templateUrl: './mission-select.page.html',
  styleUrls: ['./mission-select.page.scss'],
  standalone: true,
  /* 2. Include the same core imports as your Login page */
  imports: [
    CommonModule, 
    FormsModule, 
    IonicModule, 
    RouterModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MissionSelectPage implements OnInit {

  constructor(private router: Router) {
    /* 3. Register the icons so they actually show up */
    addIcons({ 
      scanOutline, 
      gridOutline, 
      pulseOutline, 
      locationOutline, 
      chevronBackOutline 
    });
  }

  ngOnInit() {
    // Initialization logic if needed
  }

  selectMission(type: string) {
    console.log('Selected mission type:', type);
    // Navigate to map planner
    this.router.navigate(['/map-planner'], { 
      queryParams: { missionType: type } 
    });
  }
}