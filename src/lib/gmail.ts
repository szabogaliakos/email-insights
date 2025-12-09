import type { gmail_v1 } from "googleapis";

export type ParsedAddresses = {
  senders: Set<string>;
  recipients: Set<string>;
};

const headerNames = ["From", "To", "Cc", "Bcc"];

export function extractAddressesFromMessage(
  message: gmail_v1.Schema$Message,
): ParsedAddresses {
  const senders = new Set<string>();
  const recipients = new Set<string>();

  const headers = message.payload?.headers || [];

  headers
    .filter((h) => headerNames.includes(h.name || ""))
    .forEach((header) => {
      const value = header.value || "";
      const addresses = splitAddresses(value);

      if (header.name === "From") {
        addresses.forEach((addr) => senders.add(addr));
      } else {
        addresses.forEach((addr) => recipients.add(addr));
      }
    });

  return { senders, recipients };
}

export function splitAddresses(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const match = part.match(/<([^>]+)>/);
      return (match ? match[1] : part).toLowerCase();
    })
    .filter(Boolean);
}

