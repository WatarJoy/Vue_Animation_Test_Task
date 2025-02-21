import "pixi.js";

declare global {
  namespace PIXI {
    interface Container {
      userData?: {
        originalPosition: { x: number; y: number };
        originalPolygon: Array<{ x: number; y: number }>;
      };
    }
  }
}
