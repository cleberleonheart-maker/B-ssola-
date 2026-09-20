export type Role = 'user' | 'assistant';

export type ActionResultKind =
  | 'answer'
  | 'fact'
  | 'memory'
  | 'help'
  | 'error';

export type ActionResult = {
  text: string;
  speak: boolean;
  kind: ActionResultKind;
};

export type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  speak: boolean;
  at: number;
};

export type KnownWaypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number | null;
  bearing: number | null;
};

export type AssistantContextData = {
  heading: number | null;
  cardinal: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  pressure: number | null;
  baroAvailable: boolean;
  declinationEnabled: boolean;
  declination: number;
  odometer: number;
  appMode: string;
  displayMode: string;
  theme: string;
  waypoints: KnownWaypoint[];
};

export const buildEmptyContext = (): AssistantContextData => ({
  heading: null,
  cardinal: null,
  latitude: null,
  longitude: null,
  accuracy: null,
  altitude: null,
  speed: null,
  pressure: null,
  baroAvailable: false,
  declinationEnabled: false,
  declination: 0,
  odometer: 0,
  appMode: 'full',
  displayMode: 'compass',
  theme: 'dark',
  waypoints: [],
});