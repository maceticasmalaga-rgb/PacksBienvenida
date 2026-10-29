import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, quoteRequestsTable } from "@workspace/db";
import { calculateQuote } from "@workspace/catalog";
import {
  SubmitQuoteBody,
  SubmitQuoteResponse,
} from "@workspace/api-zod";
import {
  sendQuoteNotifications,
  type QuoteNotification,
} from "../lib/quote-mailer";

const router: IRouter = Router();
const toEuro = (cents: number) => Number((cents / 100).toFixed(2));

router.post("/quotes", async (req, res): Promise<void> => {
  const parsed = SubmitQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid quote request");
    res.status(400).json({ error: "Revisa los datos del formulario." });
    return;
  }

  const data = parsed.data;
  let calculation;
  try {
    calculation = calculateQuote(data.items);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "No se ha podido calcular el presupuesto.",
    });
    return;
  }

  const storedItems = calculation.items.map((item) => ({
    selectionType: item.selectionType,
    selectionId: item.selectionId,
    name: item.name,
    quantity: item.quantity,
    units: item.units,
    unitPrice: toEuro(item.unitPriceCents),
    subtotal: toEuro(item.subtotalCents),
    discount: toEuro(item.discountCents),
    lineTotal: toEuro(item.totalCents),
  }));
  const quoteId = randomUUID();

  const [saved] = await db
    .insert(quoteRequestsTable)
    .values({
      id: quoteId,
      companyName: data.companyName.trim(),
      contactName: data.contactName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      apartmentCount: data.apartmentCount ?? null,
      items: storedItems,
      individualUnits: calculation.individualUnits,
      totalUnits: calculation.totalUnits,
      subtotal: (calculation.subtotalCents / 100).toFixed(2),
      discountTotal: (calculation.discountCents / 100).toFixed(2),
      estimatedTotal: (calculation.totalCents / 100).toFixed(2),
      notes: data.notes?.trim() || null,
    })
    .returning({
      id: quoteRequestsTable.id,
      receivedAt: quoteRequestsTable.receivedAt,
    });

  const notificationQuote: QuoteNotification = {
    id: saved.id,
    receivedAt: saved.receivedAt,
    companyName: data.companyName.trim(),
    contactName: data.contactName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone?.trim() || null,
    apartmentCount: data.apartmentCount ?? null,
    individualUnits: calculation.individualUnits,
    totalUnits: calculation.totalUnits,
    subtotalCents: calculation.subtotalCents,
    discountCents: calculation.discountCents,
    totalCents: calculation.totalCents,
    notes: data.notes?.trim() || null,
    items: calculation.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      subtotalCents: item.subtotalCents,
      discountCents: item.discountCents,
      totalCents: item.totalCents,
    })),
  };

  let emailStatuses: Awaited<ReturnType<typeof sendQuoteNotifications>> = {
    businessEmailStatus: "failed",
    customerEmailStatus: "failed",
  };
  try {
    emailStatuses = await sendQuoteNotifications(notificationQuote);
  } catch {
    req.log.error({ quoteId: saved.id }, "Quote email notifications failed");
  }

  try {
    await db
      .update(quoteRequestsTable)
      .set(emailStatuses)
      .where(eq(quoteRequestsTable.id, saved.id));
  } catch {
    req.log.error(
      { quoteId: saved.id },
      "Could not save quote email notification status",
    );
  }

  req.log.info(
    { quoteId: saved.id, ...emailStatuses },
    "Quote request stored",
  );

  res.status(201).json(
    SubmitQuoteResponse.parse({
      id: saved.id,
      receivedAt: saved.receivedAt,
      individualUnits: calculation.individualUnits,
      totalUnits: calculation.totalUnits,
      subtotal: toEuro(calculation.subtotalCents),
      discountTotal: toEuro(calculation.discountCents),
      estimatedTotal: toEuro(calculation.totalCents),
    }),
  );
});

export default router;
