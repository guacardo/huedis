const BRIDGE_IP = process.env.HUE_BRIDGE_IP;
const APP_KEY = process.env.HUE_APP_KEY;

if (!BRIDGE_IP || !APP_KEY) {
  console.error("Missing HUE_BRIDGE_IP or HUE_APP_KEY in .env");
  process.exit(1);
}

const res = await fetch(`https://${BRIDGE_IP}/clip/v2/resource/light`, {
  headers: { "hue-application-key": APP_KEY },
  // Bridge serves a self-signed cert on the LAN
  tls: { rejectUnauthorized: false },
});

if (!res.ok) {
  console.error(`Bridge returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const { data } = (await res.json()) as { data: HueLight[] };

console.log(`Found ${data.length} lights:\n`);
for (const light of data) {
  const name = light.metadata?.name ?? "(unnamed)";
  const on = light.on?.on ? "ON " : "off";
  const bri = light.dimming?.brightness?.toFixed(0) ?? "—";
  console.log(`  [${on}] ${name.padEnd(28)} bri=${bri}%`);
}

type HueLight = {
  id: string;
  metadata?: { name?: string };
  on?: { on: boolean };
  dimming?: { brightness: number };
};
