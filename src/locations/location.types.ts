export const LOCATION_TYPES = ['HOME_AREA', 'WORK', 'UNIVERSITY', 'CLINIC', 'OTHER'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationDraft {
  name: string;
  type: LocationType;
  address: string;
  note?: string;
}
