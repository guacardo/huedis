import { Hono } from "hono";
import {
  listLights,
  listRooms,
  updateLight,
  updateGroupedLight,
  type LightUpdate,
} from "./hue.ts";

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

export default {
  port: 6001,
  fetch: app.fetch,
};
