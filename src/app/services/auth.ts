import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NavController } from '@ionic/angular';

export interface User {
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // 👉 FIX 1: Injected NavController into the constructor
  constructor(private navCtrl: NavController) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<boolean> {
    return new Observable(observer => {
      setTimeout(() => {
        if (email && password) {
          const user: User = {
            email,
            name: email.split('@')[0]
          };
          
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
          observer.next(true);
        } else {
          observer.next(false);
        }
        observer.complete();
      }, 1000);
    });
  }

  logout(): void {
    // 👉 FIX 2: Destroy ALL user memory so the Bouncers (Guards) know they are logged out
    localStorage.removeItem('user_id'); 
    localStorage.removeItem('currentUser'); 
    
    // Tell the app the user is officially gone
    this.currentUserSubject.next(null);
    
    // 👉 Wipe the history and throw them to the login screen
    this.navCtrl.navigateRoot('/login');
  }

  isAuthenticated(): boolean {
    return this.currentUserValue !== null;
  }

  register(email: string, password: string, name: string): Observable<boolean> {
    return new Observable(observer => {
      setTimeout(() => {
        if (email && password && name) {
          const user: User = {
            email,
            name
          };
          
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
          observer.next(true);
        } else {
          observer.next(false);
        }
        observer.complete();
      }, 1000);
    });
  }
}