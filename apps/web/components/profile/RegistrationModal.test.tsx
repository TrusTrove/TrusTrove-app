import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RegistrationModal } from "./RegistrationModal";

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(() => ({ current: null })),
}));

describe("RegistrationModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RegistrationModal
        isOpen={false}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders the registration dialog when open", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/register business metadata/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /register profile/i }),
    ).toBeInTheDocument();
  });

  it("closes when the close button, cancel button, or backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <RegistrationModal
        isOpen={true}
        onClose={onClose}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    fireEvent.click(screen.getByLabelText("Close registration dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("submits a filled form through register and closes the modal", async () => {
    const register = vi.fn().mockResolvedValue("tx-hash-123");
    const onClose = vi.fn();
    render(
      <RegistrationModal
        isOpen={true}
        onClose={onClose}
        register={register}
        isRegistering={false}
        registerError={null}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/acme corporation/i), {
      target: { value: "  Acme Corporation  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/eu123456789/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/germany/i), {
      target: { value: "Germany" },
    });
    fireEvent.change(screen.getByPlaceholderText(/contact@acme\.corp/i), {
      target: { value: "ops@acme.corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: /register profile/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      role: "issuer",
      metadata: {
        companyName: "Acme Corporation",
        taxId: "TAX-123",
        country: "Germany",
        website: "",
        email: "ops@acme.corp",
      },
    });
  });

  it("shows a validation error when the company name is blank", async () => {
    const register = vi.fn();
    const { container } = render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={register}
        isRegistering={false}
        registerError={null}
      />,
    );

    // Whitespace passes the native `required` check but not the trim check.
    // Submitting the form directly skips constraint validation either way.
    fireEvent.change(screen.getByPlaceholderText(/acme corporation/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByPlaceholderText(/eu123456789/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/germany/i), {
      target: { value: "Germany" },
    });
    fireEvent.submit(container.ownerDocument.querySelector("form")!);

    expect(
      await screen.findByText(/company name is required/i),
    ).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows the registerError message when the mutation fails", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={new Error("Registry contract rejected the tx")}
      />,
    );

    expect(
      screen.getByText(/registry contract rejected the tx/i),
    ).toBeInTheDocument();
  });

  it("disables the submit and cancel buttons while isRegistering is true", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={true}
        registerError={null}
      />,
    );

    expect(screen.getByRole("button", { name: /signing/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
  });

  it("switching the role toggle updates the selected button's styling", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    const buyerButton = screen.getByRole("button", {
      name: /obligor \/ buyer/i,
    });
    const issuerButton = screen.getByRole("button", { name: /sme \/ issuer/i });

    expect(issuerButton.className).toContain("border-primary");
    fireEvent.click(buyerButton);
    expect(buyerButton.className).toContain("border-primary");
  });
});
