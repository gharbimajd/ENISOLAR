import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from 'src/environments/environment';

export interface ProjectMission {
  id: string;
  name: string;
  status: string;
  order_index: number;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  missions: ProjectMission[];
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private apiurl = environment.apiUrl;

  constructor() {} // HttpClient removed to avoid Android Mixed Content blocks

  getProjects(userId: string): Observable<Project[]> {
    return from(CapacitorHttp.get({
      url: `${this.apiurl}/get_projects.php`,
      params: { user_id: userId }
    })).pipe(
      map((res: HttpResponse) => res.data || [])
    );
  }

  createProject(userId: string, name: string): Observable<{ success: boolean; project_id: string }> {
    return from(CapacitorHttp.post({
      url: `${this.apiurl}/create_project.php`,
      data: { user_id: userId, name },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  deleteProject(userId: string, projectId: string): Observable<{ success: boolean }> {
    // Note: CapacitorHttp.delete handles data in 'data' or 'params' 
    // depending on how your PHP reads it. Using 'data' for the body:
    return from(CapacitorHttp.delete({
      url: `${this.apiurl}/delete_project.php`,
      data: { user_id: userId, project_id: projectId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  addMissionToProject(projectId: string, missionId: string): Observable<{ success: boolean }> {
    return from(CapacitorHttp.post({
      url: `${this.apiurl}/add_mission_to_project.php`,
      data: { project_id: projectId, mission_id: missionId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }

  removeMissionFromProject(projectId: string, missionId: string): Observable<{ success: boolean }> {
    return from(CapacitorHttp.delete({
      url: `${this.apiurl}/remove_mission_from_project.php`,
      data: { project_id: projectId, mission_id: missionId },
      headers: { 'Content-Type': 'application/json' }
    })).pipe(
      map((res: HttpResponse) => res.data)
    );
  }
}