import type { LocationDefinition } from "../types";

export const locations: LocationDefinition[] = [
  { id: "velia", name: "벨리아 마을" },
  { id: "iliya", name: "일리야 섬" },
  { id: "oquilla-eye", name: "오킬루아의 눈" },
];

export const locationById = Object.fromEntries(
  locations.map((location) => [location.id, location]),
) as Record<string, LocationDefinition>;
