import assert from "node:assert/strict";
import test from "node:test";
import { sendQuoteNotifications } from "../src/lib/quote-mailer.ts";

const quote = {
  id: "77777777-7777-4777-8777-777777777777",
  receivedAt: new Date("2026-10-29T10:00:00.000Z"),
  companyName: "Alojamiento de prueba",
  contactName: "Contacto",
  email: "cliente@example.test",
  phone: null,
  apartmentCount: 4,
  individualUnits: 11,
  totalUnits: 21,
  subtotalCents: 7633,
  discountCents: 500,
  totalCents: 7133,
  notes: "Consulta de prueba",
  items: [
    {
      name: "Pack Esencial",
      quantity: 11,
      unitPriceCents: 303,
      subtotalCents: 3333,
      discountCents: 500,
      totalCents: 2833,
    },
    {
      name: "Combo Prueba",
      quantity: 1,
      unitPriceCents: 4300,
      subtotalCents: 4300,
      discountCents: 0,
      totalCents: 4300,
    },
  ],
};

const completeEnvironment = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_FROM: "MÁLAGA WELCOME <presupuestos@example.test>",
  BUSINESS_NOTIFICATION_EMAIL: "negocio@example.test",
};

test("sends business and customer emails with the server-calculated totals", async () => {
  const sentMessages = [];
  const statuses = await sendQuoteNotifications(
    quote,
    completeEnvironment,
    () => ({
      sendMail: async (message) => {
        sentMessages.push(message);
        return { accepted: [message.to] };
      },
    }),
  );

  assert.deepEqual(statuses, {
    businessEmailStatus: "sent",
    customerEmailStatus: "sent",
  });
  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[0].to, "negocio@example.test");
  assert.equal(sentMessages[1].to, "cliente@example.test");
  assert.match(sentMessages[1].subject, /Hemos recibido/);
  assert.match(sentMessages[1].text, /Hemos recibido tu solicitud/);
  assert.match(sentMessages[0].text, /Descuento: €5\.00/);
  assert.match(sentMessages[0].text, /Total estimado: €71\.33/);
  assert.match(sentMessages[0].text, /Combo Prueba: €43\.00/);
});

test("keeps the request deliverable when one email attempt fails", async () => {
  const statuses = await sendQuoteNotifications(
    quote,
    completeEnvironment,
    () => ({
      sendMail: async (message) => {
        if (message.to === "negocio@example.test") throw new Error("SMTP unavailable");
        return { accepted: [message.to] };
      },
    }),
  );

  assert.deepEqual(statuses, {
    businessEmailStatus: "failed",
    customerEmailStatus: "sent",
  });
});

test("reports unconfigured email delivery without throwing", async () => {
  let transportCreated = false;
  const statuses = await sendQuoteNotifications(
    quote,
    {},
    () => {
      transportCreated = true;
      return { sendMail: async () => ({}) };
    },
  );

  assert.equal(transportCreated, false);
  assert.deepEqual(statuses, {
    businessEmailStatus: "not_configured",
    customerEmailStatus: "not_configured",
  });
});
