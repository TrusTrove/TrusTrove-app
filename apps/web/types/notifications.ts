import { EventLog } from "./index";

export interface NotificationEvent {
  id: string;
  type: string;
  invoiceId: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function mapEventToNotification(event: EventLog): NotificationEvent {
  const typeMap: Record<string, string> = {
    InvoiceCreated: "Invoice Created",
    create: "Invoice Created",
    InvoiceListed: "Invoice Listed",
    list_for_financing: "Invoice Listed",
    InvoiceFunded: "Invoice Funded",
    fund_invoice: "Invoice Funded",
    InvoiceShipped: "Invoice Shipped",
    mark_shipped: "Invoice Shipped",
    DeliveryConfirmed: "Delivery Confirmed",
    confirm_delivery: "Delivery Confirmed",
    InvoiceRepaid: "Invoice Repaid",
    repay: "Invoice Repaid",
    InvoiceDefaulted: "Invoice Defaulted",
    trigger_default: "Invoice Defaulted",
  };

  const type = typeMap[event.event_type] || event.event_type;
  const invId: string = event.data?.invoice_id || "";
  const invShort = invId ? `INV#${invId.slice(0, 4)}...` : "";
  let message = "";

  switch (event.event_type) {
    case "InvoiceCreated":
    case "create":
      message = `New invoice ${invShort} issued on-chain`;
      break;
    case "InvoiceListed":
    case "list_for_financing":
      message = `${invShort} listed for financing`;
      break;
    case "InvoiceFunded":
    case "fund_invoice":
      message = `${invShort} fully funded`;
      break;
    case "InvoiceShipped":
    case "mark_shipped":
      message = `${invShort} marked as shipped`;
      break;
    case "DeliveryConfirmed":
    case "confirm_delivery":
      message = `Buyer confirmed delivery for ${invShort}`;
      break;
    case "InvoiceRepaid":
    case "repay":
      message = `${invShort} repaid`;
      break;
    case "InvoiceDefaulted":
    case "trigger_default":
      message = `${invShort} defaulted`;
      break;
    default:
      message = invShort || "Event occurred";
  }

  return {
    id: String(event.id),
    type,
    invoiceId: invId,
    message,
    timestamp: event.ledger_closed_at,
    read: false,
  };
}
