import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  listLights,
  listRooms,
  updateLight,
  updateGroupedLight,
  type LightUpdate,
} from "./hue.ts";
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
