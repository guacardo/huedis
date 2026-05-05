import type { XY } from "./hue.ts";
import { bridgeGet, bridgePost, bridgePut, bridgeDelete } from "./bridge.ts";

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

type RawSceneAction = {
  target: { rid: string; rtype: string };
  action: {
    on?: { on: boolean };
    dimming?: { brightness: number };
    color?: { xy: XY };
    color_temperature?: { mirek: number };
  };
};

type RawScene = {
  id: string;
  type: string;
  metadata?: { name?: string };
  group?: { rid: string; rtype: string };
  actions?: RawSceneAction[];
};

function mapScene(raw: RawScene): Scene {
  return {
    id: raw.id,
    name: raw.metadata?.name ?? "(unnamed)",
    roomId: raw.group?.rid ?? "",
    actions: (raw.actions ?? []).map((a) => ({
      lightId: a.target.rid,
      on: a.action.on?.on,
      brightness: a.action.dimming?.brightness,
      xy: a.action.color?.xy,
      mirek: a.action.color_temperature?.mirek,
    })),
  };
}

function buildActionsBody(actions: SceneAction[]): RawSceneAction[] {
  return actions.map((a) => {
    const action: RawSceneAction["action"] = {};
    if (a.on !== undefined) action.on = { on: a.on };
    if (a.brightness !== undefined) action.dimming = { brightness: a.brightness };
    if (a.xy !== undefined) action.color = { xy: a.xy };
    if (a.mirek !== undefined) action.color_temperature = { mirek: a.mirek };
    return {
      target: { rid: a.lightId, rtype: "light" },
      action,
    };
  });
}

export async function listScenes(): Promise<Scene[]> {
  const data = await bridgeGet<RawScene[]>("scene");
  return data.map(mapScene);
}

export async function createScene(
  roomId: string,
  name: string,
  actions: SceneAction[],
): Promise<{ id: string }> {
  const data = await bridgePost<{ rid: string; rtype: string }[]>("scene", {
    type: "scene",
    metadata: { name },
    group: { rid: roomId, rtype: "room" },
    actions: buildActionsBody(actions),
  });
  return { id: data[0]!.rid };
}

export async function renameScene(id: string, name: string): Promise<void> {
  await bridgePut<unknown>(`scene/${id}`, { metadata: { name } });
}

export async function updateSceneActions(
  id: string,
  actions: SceneAction[],
): Promise<void> {
  await bridgePut<unknown>(`scene/${id}`, { actions: buildActionsBody(actions) });
}

export async function recallScene(id: string): Promise<void> {
  await bridgePut<unknown>(`scene/${id}`, { recall: { action: "active" } });
}

export async function deleteScene(id: string): Promise<void> {
  await bridgeDelete<unknown>(`scene/${id}`);
}
