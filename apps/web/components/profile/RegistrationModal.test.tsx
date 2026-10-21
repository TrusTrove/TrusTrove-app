import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
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

    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "  Acme Corporation  " },
    });
    fireEvent.change(screen.getByLabelText(/tax id \/ registration no/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByLabelText(/country of incorporation/i), {
      target: { value: "Germany" },
    });
    fireEvent.change(screen.getByLabelText(/contact email \(optional\)/i), {
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
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText(/tax id \/ registration no/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByLabelText(/country of incorporation/i), {
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

  it("exposes the role picker as a labelled radio group", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    const group = screen.getByRole("group", {
      name: /select on-chain business role/i,
    });
    expect(group).toBeInTheDocument();

    const issuer = screen.getByRole("radio", { name: /sme \/ issuer/i });
    const buyer = screen.getByRole("radio", { name: /obligor \/ buyer/i });
    expect(issuer).toBeChecked();
    expect(buyer).not.toBeChecked();

    fireEvent.click(buyer);
    expect(buyer).toBeChecked();
    expect(issuer).not.toBeChecked();
  });

  it("labels every text input, including the optional website field", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    expect(screen.getByLabelText(/company name/i)).toHaveAttribute(
      "id",
      "registration-company-name",
    );
    expect(
      screen.getByLabelText(/corporate website url \(optional\)/i),
    ).toHaveAttribute("type", "url");
  });

  it("announces errors through an alert region", () => {
    render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={new Error("Registry contract rejected the tx")}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /registry contract rejected the tx/i,
    );
  });

  // #1106: the inline validation error must land in the role=alert region,
  // not just be visible text (the registerError half of this criterion is
  // covered upstream by the "announces errors through an alert region" test
  // added in #1153, so we keep only the validation-error assertion here).
  it("announces inline validation errors inside the role=alert region (#1106)", async () => {
    const { container } = render(
      <RegistrationModal
        isOpen={true}
        onClose={vi.fn()}
        register={vi.fn()}
        isRegistering={false}
        registerError={null}
      />,
    );

    // Whitespace passes the native `required` check but not the trim check;
    // submitting the form directly skips constraint validation either way
    // (same technique as the #1153 validation test).
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText(/tax id \/ registration no/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByLabelText(/country of incorporation/i), {
      target: { value: "Germany" },
    });
    fireEvent.submit(container.ownerDocument.querySelector("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/company name is required/i);
  });

  // #1099: while registration is pending, exactly one aria-modal dialog must
  // be active. The registration modal closes before the pending dialog opens.
  it("shows exactly one aria-modal dialog while registration is pending (#1099)", async () => {
    let resolveRegister: ((value: string) => void) | null = null;
    const register = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRegister = resolve;
        }),
    );

    function Harness() {
      const [isOpen, setIsOpen] = React.useState(true);
      return (
        <RegistrationModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          register={register}
          isRegistering={false}
          registerError={null}
        />
      );
    }

    render(<Harness />);

    // The registration dialog is the only modal initially.
    expect(screen.queryAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "Acme Corporation" },
    });
    fireEvent.change(screen.getByLabelText(/tax id \/ registration no/i), {
      target: { value: "TAX-123" },
    });
    fireEvent.change(screen.getByLabelText(/country of incorporation/i), {
      target: { value: "Germany" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /register profile/i }),
      );
    });

    // Before register resolves, only one dialog may carry aria-modal=true.
    const modals = screen.queryAllByRole("dialog");
    expect(modals).toHaveLength(1);
    expect(modals[0]).toHaveAttribute("aria-modal", "true");

    // Resolving the registration leaves the (single) pending dialog open
    // until the user dismisses it.
    act(() => {
      resolveRegister!("tx-hash-123");
    });
    await waitFor(() => {
      const modals = screen.queryAllByRole("dialog");
      expect(modals).toHaveLength(1);
      expect(modals[0]).toHaveAttribute("aria-modal", "true");
    });
  });
});
