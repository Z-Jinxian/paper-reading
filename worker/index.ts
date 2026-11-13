import { serveNotebook } from "./notebook";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function authenticated(request: Request, password: string) {
  const token = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return false;
  let credentials: Uint8Array<ArrayBuffer>;
  try {
    credentials = Uint8Array.from(atob(token), (character) => character.charCodeAt(0));
  } catch {
    return false;
  }
  const expected = new TextEncoder().encode("notebook:" + password);
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", credentials),
    crypto.subtle.digest("SHA-256", expected),
  ]);
  return crypto.subtle.timingSafeEqual(actualHash, expectedHash);
}

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    const url = new URL(request.url);
    const local = import.meta.env.DEV && loopbackHosts.has(url.hostname);
    if (!local && (url.protocol !== "https:" || !env.NOTEBOOK_PASSWORD)) {
      return new Response("Remote access requires HTTPS and NOTEBOOK_PASSWORD.", { status: 403 });
    }
    if (env.NOTEBOOK_PASSWORD && !(await authenticated(request, env.NOTEBOOK_PASSWORD))) {
      return new Response("Authentication required.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Paper Reading", charset="UTF-8"',
          "Cache-Control": "no-store",
        },
      });
    }
    return await serveNotebook(request, env) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
