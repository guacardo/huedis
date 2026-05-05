import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  listLights,
  listRooms,
  updateLight,
  updateGroupedLight,
  type LightUpdate,
} from "./hue.ts";
import {
  listScenes,
  createScene,
  renameScene,
  updateSceneActions,
  recallScene,
  deleteScene,
  type SceneAction,
} from "./scenes.ts";
import {
  startAnimation,
  stopAnimation,
  listAnimations,
  type Animation,
} from "./animations.ts";
import { startBridgeStream, subscribe } from "./sse.ts";

const app = new Hono();

app.get("/api/lights", async (c) => {
  return c.json(await listLights());
});

app.put("/api/lights/:id", async (c) => {
  const id = c.req.param("id");
  const update = (await c.req.json()) as LightUpdate;
  await updateLight(id, update);
  return c.json({ ok: true });
});

app.get("/api/rooms", async (c) => {
  return c.json(await listRooms());
});

app.put("/api/rooms/:id", async (c) => {
  const groupedLightId = c.req.param("id");
  const update = (await c.req.json()) as LightUpdate;
  await updateGroupedLight(groupedLightId, update);
  return c.json({ ok: true });
});

app.get("/api/scenes", async (c) => {
  return c.json(await listScenes());
});

app.post("/api/scenes", async (c) => {
  const { roomId, name, actions } = (await c.req.json()) as {
    roomId: string;
    name: string;
    actions: SceneAction[];
  };
  return c.json(await createScene(roomId, name, actions));
});

app.put("/api/scenes/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { name?: string; actions?: SceneAction[] };
  if (body.name !== undefined) await renameScene(id, body.name);
  if (body.actions !== undefined) await updateSceneActions(id, body.actions);
  return c.json({ ok: true });
});

app.post("/api/scenes/:id/recall", async (c) => {
  await recallScene(c.req.param("id"));
  return c.json({ ok: true });
});

app.delete("/api/scenes/:id", async (c) => {
  await deleteScene(c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/api/animations", (c) => c.json(listAnimations()));

app.post("/api/animations/start", async (c) => {
  const { roomId, animation } = (await c.req.json()) as {
    roomId: string;
    animation: Animation;
  };
  return c.json(await startAnimation(roomId, animation));
});

app.post("/api/animations/stop", async (c) => {
  const { roomId } = (await c.req.json()) as { roomId: string };
  return c.json({ stopped: stopAnimation(roomId) });
});

app.get("/api/events", (c) =>
  streamSSE(c, async (stream) => {
    const unsub = subscribe(async (update) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(update) });
      } catch {
        // client gone; cleanup happens via onAbort
      }
    });
    stream.onAbort(unsub);

    // Periodic ping keeps proxies and idle-detection happy.
    while (!stream.aborted) {
      await stream.sleep(30_000);
      if (!stream.aborted) {
        try {
          await stream.writeSSE({ event: "ping", data: "" });
        } catch {
          break;
        }
      }
    }
    unsub();
  }),
);

startBridgeStream();

export default {
  port: 6001,
  fetch: app.fetch,
};
