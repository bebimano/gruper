// Firebase Cloud Messaging (HTTP v1) sender — works for Android and iPhone (APNs via Firebase).
type SA = { client_email: string; private_key: string; project_id: string };

const b64url = (b: ArrayBuffer | string) => {
  const s = typeof b === "string" ? btoa(unescape(encodeURIComponent(b))) : btoa(String.fromCharCode(...new Uint8Array(b)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(sa: SA) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`Firebase auth failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

/** Returns tokens that Firebase reports as no longer valid. */
export async function sendPush(tokens: string[], title: string, body: string, link: string): Promise<string[]> {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw || !tokens.length) return [];
  const sa = JSON.parse(raw) as SA;
  const at = await accessToken(sa);
  const dead: string[] = [];
  await Promise.all(tokens.map(async (token) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, notification: { title, body }, data: { link }, apns: { payload: { aps: { sound: "default" } } } } }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`FCM send failed [${res.status}]: ${t}`);
      if (res.status === 404 || t.includes("UNREGISTERED")) dead.push(token);
    }
  }));
  return dead;
}
