import nodemailer, { type SendMailOptions } from "nodemailer";

export type EmailDeliveryStatus = "not_configured" | "sent" | "failed";

export type QuoteNotificationItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

export type QuoteNotification = {
  id: string;
  receivedAt: Date;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  apartmentCount: number | null;
  individualUnits: number;
  totalUnits: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  items: QuoteNotificationItem[];
};

type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
};

type MailTransport = {
  sendMail: (message: SendMailOptions) => Promise<unknown>;
};

type TransportFactory = (options: SmtpOptions) => MailTransport;

type NotificationEnvironment = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  BUSINESS_NOTIFICATION_EMAIL?: string;
};

const formatEuro = (cents: number) => `€${(cents / 100).toFixed(2)}`;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

function buildEmailContent(quote: QuoteNotification) {
  const textItems = quote.items.map(
    (item) =>
      `${item.quantity} × ${item.name}: ${formatEuro(item.totalCents)}${
        item.discountCents
          ? ` (descuento ${formatEuro(item.discountCents)})`
          : ""
      }`,
  );
  const htmlItems = quote.items
    .map(
      (item) =>
        `<li>${item.quantity} × ${escapeHtml(item.name)}: ${formatEuro(item.totalCents)}${
          item.discountCents
            ? ` (descuento ${formatEuro(item.discountCents)})`
            : ""
        }</li>`,
    )
    .join("");
  const detailLines = [
    `Referencia: ${quote.id}`,
    `Recibida: ${quote.receivedAt.toISOString()}`,
    `Contacto: ${quote.contactName}`,
    `Empresa: ${quote.companyName}`,
    `Correo: ${quote.email}`,
    `Teléfono: ${quote.phone ?? "No indicado"}`,
    `Alojamientos: ${quote.apartmentCount ?? "No indicado"}`,
    `Unidades individuales: ${quote.individualUnits}`,
    `Unidades totales: ${quote.totalUnits}`,
    `Subtotal: ${formatEuro(quote.subtotalCents)}`,
    `Descuento: ${formatEuro(quote.discountCents)}`,
    `Total estimado: ${formatEuro(quote.totalCents)}`,
    "",
    "Productos:",
    ...textItems,
    "",
    `Comentarios: ${quote.notes ?? "Sin comentarios"}`,
  ];

  return {
    text: detailLines.join("\n"),
    html: `<h2>Solicitud de presupuesto ${escapeHtml(quote.id)}</h2><p>Recibida ${escapeHtml(
      quote.receivedAt.toISOString(),
    )}</p><ul>${htmlItems}</ul><p>Contacto: ${escapeHtml(
      quote.contactName,
    )}<br>Empresa: ${escapeHtml(quote.companyName)}<br>Correo: ${escapeHtml(
      quote.email,
    )}<br>Teléfono: ${escapeHtml(
      quote.phone ?? "No indicado",
    )}<br>Alojamientos: ${quote.apartmentCount ?? "No indicado"}</p><p>Unidades individuales: ${
      quote.individualUnits
    } · Unidades totales: ${quote.totalUnits}<br>Subtotal: ${formatEuro(
      quote.subtotalCents,
    )}<br>Descuento: ${formatEuro(
      quote.discountCents,
    )}<br><strong>Total estimado: ${formatEuro(
      quote.totalCents,
    )}</strong></p><p>Comentarios: ${escapeHtml(
      quote.notes ?? "Sin comentarios",
    )}</p>`,
  };
}

export async function sendQuoteNotifications(
  quote: QuoteNotification,
  environment: NotificationEnvironment = process.env,
  createTransport: TransportFactory = (options) =>
    nodemailer.createTransport(options),
): Promise<{
  businessEmailStatus: EmailDeliveryStatus;
  customerEmailStatus: EmailDeliveryStatus;
}> {
  const host = environment.SMTP_HOST?.trim();
  const from = environment.SMTP_FROM?.trim();
  const port = Number(environment.SMTP_PORT);
  const smtpUser = environment.SMTP_USER?.trim();
  const smtpPassword = environment.SMTP_PASSWORD;
  const hasAuthPair = Boolean(smtpUser && smtpPassword);
  const invalidAuthPair = Boolean(smtpUser) !== Boolean(smtpPassword);
  const transportConfigured =
    Boolean(host && from && Number.isInteger(port) && port > 0 && port <= 65535) &&
    !invalidAuthPair;

  if (!transportConfigured) {
    return {
      businessEmailStatus: "not_configured",
      customerEmailStatus: "not_configured",
    };
  }

  const transport = createTransport({
    host: host!,
    port,
    secure: port === 465,
    ...(hasAuthPair ? { auth: { user: smtpUser!, pass: smtpPassword! } } : {}),
  });
  const content = buildEmailContent(quote);
  const businessAddress = environment.BUSINESS_NOTIFICATION_EMAIL?.trim();
  const send = async (to: string | undefined, subject: string) => {
    if (!to) return "not_configured" as const;
    const isCustomer = to.trim().toLowerCase() === quote.email.toLowerCase();
    const customerText =
      "Hemos recibido tu solicitud de presupuesto. Esta confirmación no implica compromiso y el equipo revisará los detalles.";
    try {
      await transport.sendMail({
        from,
        to,
        subject,
        text: isCustomer
          ? `${customerText}\n\n${content.text}`
          : content.text,
        html: isCustomer
          ? `<p>${escapeHtml(customerText)}</p>${content.html}`
          : content.html,
      });
      return "sent" as const;
    } catch {
      return "failed" as const;
    }
  };

  const [businessEmailStatus, customerEmailStatus] = await Promise.all([
    send(businessAddress, `Nueva solicitud de presupuesto · ${quote.id}`),
    send(quote.email, `Hemos recibido tu solicitud · ${quote.id}`),
  ]);

  return { businessEmailStatus, customerEmailStatus };
}
