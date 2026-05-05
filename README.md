# huedis

Local Philips Hue control panel for the box's LAN. Bun + Hono server, Svelte 5 frontend, served as a PWA so it installs on the desktop (via Omarchy/walker) and on iPhone (via Safari → Add to Home Screen).

Single-user, LAN-only, not distributed.

## Setup

Copy `.env.example` to `.env` and fill in:

```
HUE_BRIDGE_IP=192.168.50.X
HUE_APP_KEY=
HUE_CLIENT_KEY=
```

To pair with the bridge for the first time, press the link button on the bridge, then POST to `https://<bridge-ip>/api` with `{"devicetype":"huedis","generateclientkey":true}` to get an app key + client key.

Sanity check the connection:

```
bun run probe
```

## Dev

```
bun run dev
```

Runs the bun server on `:6001` and the vite dev server on `:6173` (with `/api` proxied to the server). Hot reload on both.

## Prod

`bun run start:prod` — builds the SPA into `web/dist` and starts the server, which serves the built assets and falls back to `index.html` for client-side routes.

In practice, the server runs as a systemd user service so it's always up:

- Unit: `~/.config/systemd/user/huedis.service`
- Logs: `journalctl --user -u huedis -f`
- Restart: `systemctl --user restart huedis`

The unit calls `bun run server/src/index.ts` directly — it doesn't auto-build. After frontend changes, `bun run build` from the repo root.

## Install as an app

**Desktop (Omarchy):** already registered via `omarchy-webapp-install` — opens via walker (SUPER+SPACE → "huedis"). Removes via `omarchy-webapp-remove huedis`. Points at `http://localhost:6001`.

**iPhone:** Safari → `http://box.local:6001` → Share → Add to Home Screen. Must be Safari (Chrome/Firefox on iOS can't install PWAs). Requires box and phone on the same LAN. Service worker won't register over plain HTTP from a non-localhost origin, so no offline cache — fine since the bridge is also LAN-only.

## Network

- Server: `:6001`, listens on all interfaces
- Vite dev: `:6173`
- LAN hostname: `box.local` (mDNS via avahi, advertised on `enp5s0` only — see `/etc/avahi/avahi-daemon.conf`)
- ufw rule: TCP 6001 allowed from `192.168.50.0/24`

## Layout

- `server/src/` — Hono routes, Hue client, scenes, animations, SSE bridge stream
- `web/src/` — Svelte 5 app
- `web/public/` — manifest, sw.js, icons (copied to `dist` at build)
- `probe.ts` — bridge connectivity check
