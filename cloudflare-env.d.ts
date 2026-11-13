declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ASSETS: Fetcher;
    NOTEBOOK_CREDENTIAL_KEY?: string;
    NOTEBOOK_PASSWORD?: string;
  }
}
