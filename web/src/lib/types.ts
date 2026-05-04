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
};

export type LightUpdate = {
  on?: boolean;
  brightness?: number;
  xy?: XY;
  mirek?: number;
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
