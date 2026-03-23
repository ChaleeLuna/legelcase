import app from "../expressApp";

export default function handler(req: any, res: any) {
  // Vercel's function mount may omit the `/api` prefix when passing the request
  // to Express. Our Express routes are defined under `/api/...`, so we
  // normalize the URL to keep them matching in production.
  if (req && typeof req.url === "string" && !req.url.startsWith("/api")) {
    const prefix = "/api";
    req.url = req.url.startsWith("/") ? `${prefix}${req.url}` : `${prefix}/${req.url}`;
  }

  return app(req, res);
}
