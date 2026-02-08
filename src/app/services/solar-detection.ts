import { Injectable } from '@angular/core';

// On dit à TypeScript que la variable "cv" existe (chargée dans index.html)
declare var cv: any;

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class SolarDetectionService {

  constructor() { }

  /**
   * Cette fonction prend l'ID d'une balise <img> et renvoie la liste des panneaux trouvés.
   */
 public detectPanels(imageElementId: string): PanelRect[] {
    let src = cv.imread(imageElementId);
    let dst = new cv.Mat();
    let panels: PanelRect[] = [];

    // 1. GRIS
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    // 2. FLOU (On augmente la force de 5x5 à 9x9 pour tuer les détails)
    let ksize = new cv.Size(9, 9);
    cv.GaussianBlur(src, src, ksize, 0, 0, cv.BORDER_DEFAULT);

    // 3. CANNY (Détection des bords)
    // On augmente le seuil bas (50 -> 75) pour ignorer l'herbe sombre
    cv.Canny(src, dst, 75, 200, 3, false);

    // --- NOUVEAUTÉ : DILATATION ---
    // Cela va épaissir les lignes blanches pour bien fermer les rectangles
    let M = cv.Mat.ones(3, 3, cv.CV_8U);
    let anchor = new cv.Point(-1, -1);
    // On dilate 2 fois (iterations: 2)
    cv.dilate(dst, dst, M, anchor, 2, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    M.delete(); 
    // -----------------------------

    // 4. CONTOURS
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      
      // 5. FILTRE DE TAILLE (Area)
      // J'ai augmenté drastiquement le minimum (500 -> 2000)
      // Cela va éliminer tous les petits carrés rouges parasites
      let area = cv.contourArea(cnt);
      if (area < 2000 || area > 200000) { 
        continue; 
      }

      // 6. GEOMETRIE
      let peri = cv.arcLength(cnt, true);
      let approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.04 * peri, true);

      // On est plus tolérant : si l'objet a 4 côtés (ou un peu plus à cause du bruit)
      if (approx.rows >= 4 && approx.rows <= 6) {
        let rect = cv.boundingRect(cnt);
        let ratio = rect.width / rect.height;

        // Un panneau est souvent rectangulaire (plus large que haut ou inversement)
        // On évite les carrés parfaits (ratio proche de 1) si c'est du bruit
        // Ici on accepte tout rectangle raisonnable
        if (ratio > 0.3 && ratio < 5.0) {
          panels.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      }
      approx.delete();
    }

    // DEBUG : Si vous voulez voir ce que l'ordi "voit" (en noir et blanc)
    // Décommentez la ligne ci-dessous pour afficher l'image binaire dans le canvas
    cv.imshow('canvasOutput', dst); 

    // Nettoyage
    src.delete();
    dst.delete();
    contours.delete();
    hierarchy.delete();

    return panels;
  }
}