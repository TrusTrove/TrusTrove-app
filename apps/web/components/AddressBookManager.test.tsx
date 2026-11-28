import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressBookManager } from "./AddressBookManager";
import { getAddressBook } from "../lib/address-book";

describe("AddressBookManager Component", () => {
  const wallet = "GWALLET_TEST";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("prompts when no wallet is connected", () => {
    render(<AddressBookManager walletAddress={null} />);
    expect(screen.getByText(/Connect a wallet/i)).toBeDefined();
  });

  it("allows adding, editing and removing an alias", () => {
    render(<AddressBookManager walletAddress={wallet} />);

    const addressInput = screen.getByPlaceholderText("G...");
    const aliasInput = screen.getByPlaceholderText("e.g. Alice Issuer");
    const addButton = screen.getByRole("button", { name: "Add Alias" });

    fireEvent.change(addressInput, { target: { value: "GPEER123456789" } });
    fireEvent.change(aliasInput, { target: { value: "Peer One" } });
    fireEvent.click(addButton);

    expect(getAddressBook(wallet)["GPEER123456789"]).toEqual("Peer One");
    expect(screen.getByText("Peer One")).toBeDefined();
    expect(screen.getByText(/GPEER123456789/)).toBeDefined();

    const editButton = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editButton);

    const aliasInputEdit = screen.getByDisplayValue("Peer One");
    fireEvent.change(aliasInputEdit, { target: { value: "Peer Updated" } });
    const updateButton = screen.getByRole("button", { name: "Update Alias" });
    fireEvent.click(updateButton);

    expect(getAddressBook(wallet)["GPEER123456789"]).toEqual("Peer Updated");

    const removeButton = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(removeButton);

    expect(getAddressBook(wallet)).toEqual({});
  });
});
