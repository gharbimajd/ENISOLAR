import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { GuestGuard } from './guards/guest-guard';
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  // --- PUBLIC PAGES (Only accessible if NOT logged in) ---
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage),
    canActivate: [GuestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then(m => m.RegisterPage),
    canActivate: [GuestGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
    canActivate: [GuestGuard]
  },

  // --- PRIVATE PAGES (Only accessible if LOGGED IN) ---
  {
    path: 'mission-select',
    loadComponent: () => import('./mission-select/mission-select.page').then(m => m.MissionSelectPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'map-planner', 
    loadComponent: () => import('./pages/map-planner/map-planner.page').then(m => m.MapPlannerPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'map-planner/:id', 
    loadComponent: () => import('./pages/map-planner/map-planner.page').then(m => m.MapPlannerPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'mission-status',
    loadComponent: () => import('./pages/mission-status/mission-status.page').then(m => m.MissionStatusPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'mission-status/:id',
    loadComponent: () => import('./pages/mission-status/mission-status.page').then(m => m.MissionStatusPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then(m => m.ProfilePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'aux-map-planner/:id',
    loadComponent: () => import('./aux-map-planner/aux-map-planner.page').then(m => m.AuxMapPlannerPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.page').then(m => m.SettingsPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'manage-profile',
    loadComponent: () => import('./manage-profile/manage-profile.page').then(m => m.ManageProfilePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'support',
    loadComponent: () => import('./support/support.page').then(m => m.SupportPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'manage-missions',
    loadComponent: () => import('./manage-missions/manage-missions.page').then( m => m.ManageMissionsPage)
  },
  {
    path: 'edit-mission',
    loadComponent: () => import('./edit-mission/edit-mission.page').then( m => m.EditMissionPage)
  },
  {
    path: 'project-manager',
    loadComponent: () => import('./project-manager/project-manager.page').then( m => m.ProjectManagerPage)
  },
  {
    path: 'project-detail',
    loadComponent: () => import('./project-detail/project-detail.page').then( m => m.ProjectDetailPage)
  },
  {
    path: 'drone-manager',
    loadComponent: () => import('./drone-manager/drone-manager.page').then( m => m.DroneManagerPage)
  },
  {
    path: 'link-drone',
    loadComponent: () => import('./link-drone/link-drone.page').then( m => m.LinkDronePage)
  },
  {
    path: 'drone-detail',
    loadComponent: () => import('./drone-detail/drone-detail.page').then( m => m.DroneDetailPage)
  },
  {
    path: 'buffer-manager',
    loadComponent: () => import('./buffer-manager/buffer-manager.page').then( m => m.BufferManagerPage)
  }
];

