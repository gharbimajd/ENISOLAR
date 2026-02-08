import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },

  // --- FIX STARTS HERE ---
  
  // 1. For the Side Menu (No ID provided -> treats as new/blank)
  {
    path: 'map-planner', 
    loadComponent: () => import('./pages/map-planner/map-planner.page').then( m => m.MapPlannerPage)
  },
  
  // 2. For Editing/Specific Missions (ID provided)
  {
    path: 'map-planner/:id', 
    loadComponent: () => import('./pages/map-planner/map-planner.page').then( m => m.MapPlannerPage)
  },

  // --- FIX ENDS HERE ---
   {
    path: 'mission-status',
    loadComponent: () => import('./pages/mission-status/mission-status.page').then( m => m.MissionStatusPage)
  },

  {
    path: 'mission-status/:id',
    loadComponent: () => import('./pages/mission-status/mission-status.page').then( m => m.MissionStatusPage)
  },
];

