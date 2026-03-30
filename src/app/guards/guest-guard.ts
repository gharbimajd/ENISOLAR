import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const userId = localStorage.getItem('user_id');
    
    if (!userId) {
      return true;
    } else {
      this.router.navigate(['/mission-select'], { replaceUrl: true });
      return false;
    }
  }
}