import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { StellarToml } from "@stellar/stellar-sdk";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server!.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
});

describe("Stellar TOML resolver compatibility", () => {
  it("parses stellar.toml through the patched TOML dependency", async () => {
    server = createServer((request, response) => {
      if (request.url !== "/.well-known/stellar.toml") {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "text/plain" });
      response.end(
        [
          'VERSION = "2.1.0"',
          'NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"',
          'ACCOUNTS = ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"]',
        ].join("\n"),
      );
    });

    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Local Stellar TOML test server did not bind a TCP port");
    }

    const result = await StellarToml.Resolver.resolve(
      `127.0.0.1:${address.port}`,
      { allowHttp: true },
    );

    expect(result.VERSION).toBe("2.1.0");
    expect(result.NETWORK_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(result.ACCOUNTS).toEqual([
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ]);
  });
});
