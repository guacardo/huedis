export type XY = { x: number; y: number };
export type Gamut = { red: XY; green: XY; blue: XY };
export type GamutType = "A" | "B" | "C" | "other";

export type Light = {
  id: string;
  name: string;
  on: boolean;
  brightness: number | null;
  color: {
    xy: XY;
    gamut: Gamut | null;
    gamutType: GamutType;
  } | null;
  colorTemp: {
    mirek: number | null;
    min: number;
    max: number;
  } | null;
  effects: {
    current: string;
    supported: string[];
  } | null;
};

export type LightUpdate = {
  on?: boolean;
  brightness?: number;
  xy?: XY;
  mirek?: number;
  effect?: string;
};

export type RoomState = {
  on: boolean;
  brightness: number | null;
  xy: XY | null;
  mirek: number | null;
};

export type Room = {
  id: string;
  name: string;
  groupedLightId: string;
  lightIds: string[];
  state: RoomState;
};

export type SceneAction = {
  lightId: string;
  on?: boolean;
  brightness?: number;
  xy?: XY;
  mirek?: number;
};

export type Scene = {
  id: string;
  name: string;
  roomId: string;
  actions: SceneAction[];
};

export type IntervalAnimation = {
  type: "interval";
  speed: number;       // revolutions per minute
  saturation: number;  // 0..1
};

export type Animation = IntervalAnimation;

export type ActiveAnimation = {
  roomId: string;
  animation: Animation;
};
