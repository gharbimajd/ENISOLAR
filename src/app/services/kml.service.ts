import { Injectable } from '@angular/core';
import { Waypoint } from '../models/mission.model';

@Injectable({
  providedIn: 'root'
})
export class KmlService {

  constructor() { }

  /**
   * Lit un fichier KML et retourne un tableau de Waypoints (le polygone)
   */
  async parseKmlFile(file: File): Promise<Waypoint[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const kmlText = e.target.result;
          const waypoints = this.extractCoordinates(kmlText);
          resolve(waypoints);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  private extractCoordinates(xmlStr: string): Waypoint[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, "text/xml");

    // On cherche les coordonnées (souvent dans <coordinates> ou <Coordinates>)
    const coordinatesTag = xmlDoc.getElementsByTagName("coordinates")[0] || xmlDoc.getElementsByTagName("Coordinates")[0];

    if (!coordinatesTag || !coordinatesTag.textContent) {
      throw new Error("Aucune coordonnée trouvée dans ce fichier KML.");
    }

    // Nettoyage: enlève les espaces et retours à la ligne superflus
    const rawText = coordinatesTag.textContent.trim();
    // Séparation par espace ou retour chariot
    const rawPoints = rawText.split(/\s+/);

    const polygon: Waypoint[] = [];

    rawPoints.forEach((pointStr) => {
      // KML standard : Longitude,Latitude,Altitude (ex: 10.123,36.456,0)
      const parts = pointStr.split(',');

      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]); // Attention: KML = X (Lng) en premier
        const lat = parseFloat(parts[1]); // Attention: KML = Y (Lat) en deuxième
        
        // Vérification de validité
        if (!isNaN(lat) && !isNaN(lng)) {
          polygon.push({
            lat: lat,
            lng: lng
            // On ne met pas index/alt ici, c'est géré par le MissionService
          });
        }
      }
    });

    // Optionnel : Retirer le dernier point s'il est identique au premier (fermeture de boucle KML)
    if (polygon.length > 3) {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) {
        polygon.pop();
      }
    }

    if (polygon.length < 3) {
      throw new Error("Le fichier ne contient pas assez de points pour former un polygone valide.");
    }

    return polygon;
  }
}
