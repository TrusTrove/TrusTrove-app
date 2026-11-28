"use client";

import React, { useState, useEffect } from "react";
import {
  getAddressBook,
  setAddressAlias,
  removeAddressAlias,
} from "../lib/address-book";

interface AddressBookManagerProps {
  walletAddress: string | null;
}

export function AddressBookManager({ walletAddress }: AddressBookManagerProps) {
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [targetAddress, setTargetAddress] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [editingTarget, setEditingTarget] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      setAliases(getAddressBook(walletAddress));
    } else {
      setAliases({});
    }
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className="p-4 rounded border border-gray-200 text-gray-500">
        Connect a wallet to manage local address book aliases.
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAddress.trim()) return;
    const next = setAddressAlias(
      walletAddress,
      targetAddress.trim(),
      aliasInput,
    );
    setAliases(next);
    setTargetAddress("");
    setAliasInput("");
    setEditingTarget(null);
  };

  const handleEdit = (addr: string, currentAlias: string) => {
    setEditingTarget(addr);
    setTargetAddress(addr);
    setAliasInput(currentAlias);
  };

  const handleRemove = (addr: string) => {
    const next = removeAddressAlias(walletAddress, addr);
    setAliases(next);
    if (editingTarget === addr) {
      setEditingTarget(null);
      setTargetAddress("");
      setAliasInput("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {editingTarget ? "Edit Address Alias" : "Add Address Alias"}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Counterparty Address
            </label>
            <input
              type="text"
              disabled={Boolean(editingTarget)}
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="G..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Alias
            </label>
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="e.g. Alice Issuer"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              {editingTarget ? "Update Alias" : "Add Alias"}
            </button>
            {editingTarget && (
              <button
                type="button"
                onClick={() => {
                  setEditingTarget(null);
                  setTargetAddress("");
                  setAliasInput("");
                }}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Saved Aliases
        </h3>
        {Object.keys(aliases).length === 0 ? (
          <p className="text-sm text-gray-500">
            No aliases saved for this wallet yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {Object.entries(aliases).map(([addr, alias]) => (
              <li key={addr} className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{alias}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    Full Address: {addr}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(addr, alias)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(addr)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
