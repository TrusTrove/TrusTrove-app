import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { RegistryClient } from "../dist/clients/registry.js";
import { PoolClient } from "../dist/clients/pool.js";
import { InvoiceClient } from "../dist/clients/invoice.js";
import { EscrowClient } from "../dist/clients/escrow.js";

const adminAddress = Keypair.random().publicKey();

function createClient(ClientClass) {
  return new (class extends ClientClass {
    constructor() {
      super("test-contract");
    }

    async writeContract(method, args, publicKey) {
      this.captured = { method, args, publicKey };
      return "tx-hash";
    }
  })();
}

test("RegistryClient.initialize forwards the admin address to the contract", async () => {
  const client = createClient(RegistryClient);
  const txHash = await client.initialize(adminAddress, "signer-key");

  assert.equal(txHash, "tx-hash");
  assert.equal(client.captured.method, "initialize");
  assert.equal(client.captured.publicKey, "signer-key");
  assert.equal(client.captured.args.length, 1);
});

test("PoolClient.initialize forwards the admin address to the contract", async () => {
  const client = createClient(PoolClient);
  const txHash = await client.initialize(adminAddress, "signer-key");

  assert.equal(txHash, "tx-hash");
  assert.equal(client.captured.method, "initialize");
  assert.equal(client.captured.publicKey, "signer-key");
  assert.equal(client.captured.args.length, 1);
});

test("InvoiceClient.initialize forwards the admin address to the contract", async () => {
  const client = createClient(InvoiceClient);
  const txHash = await client.initialize(adminAddress, "signer-key");

  assert.equal(txHash, "tx-hash");
  assert.equal(client.captured.method, "initialize");
  assert.equal(client.captured.publicKey, "signer-key");
  assert.equal(client.captured.args.length, 1);
});

test("EscrowClient.initialize forwards the admin address to the contract", async () => {
  const client = createClient(EscrowClient);
  const txHash = await client.initialize(adminAddress, "signer-key");

  assert.equal(txHash, "tx-hash");
  assert.equal(client.captured.method, "initialize");
  assert.equal(client.captured.publicKey, "signer-key");
  assert.equal(client.captured.args.length, 1);
});
