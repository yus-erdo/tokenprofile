import http from "http";
import fs from "fs";
import path from "path";

interface CapturedRequest {
  body: string;
  headers: http.IncomingHttpHeaders;
}

export function createMockServer() {
  let lastRequest: CapturedRequest | null = null;
  const requests: CapturedRequest[] = [];

  const server = http.createServer((req, res) => {
    // Serve hook script for installer tests
    if (req.method === "GET" && req.url?.includes("tokenprofile-hook.sh")) {
      const script = fs.readFileSync(
        path.resolve(__dirname, "../../scripts/tokenprofile-hook.sh"),
        "utf-8"
      );
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(script);
      return;
    }

    // Capture POST requests
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const captured = { body, headers: req.headers };
        lastRequest = captured;
        requests.push(captured);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return {
    start: () =>
      new Promise<number>((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          resolve(typeof addr === "object" ? addr!.port : 0);
        });
      }),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    getLastRequest: () => lastRequest,
    getRequests: () => requests,
    reset: () => {
      lastRequest = null;
      requests.length = 0;
    },
  };
}
