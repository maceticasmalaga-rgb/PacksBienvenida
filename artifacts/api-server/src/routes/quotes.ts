import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, quoteRequestsTable } from "@workspace/db";
import {
  SubmitQuoteBody,
  SubmitQuoteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/quotes", async (req, res): Promise<void> => {
  const parsed = SubmitQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid quote request");
    res.status(400).json({ error: "Revisa los datos del formulario." });
    return;
  }

  const data = parsed.data;
  const lineTotalsInCents = data.items.map((item) => Math.round(item.lineTotal * 100));
  const expectedLineTotalsInCents = data.items.map(
    (item) => Math.round(item.unitPrice * 100) * item.quantity,
  );
  const estimatedTotalInCents = lineTotalsInCents.reduce((sum, value) => sum + value, 0);
  const requestedTotalInCents = Math.round(data.estimatedTotal * 100);

  if (
    lineTotalsInCents.some((value, index) => value !== expectedLineTotalsInCents[index]) ||
    estimatedTotalInCents !== requestedTotalInCents
  ) {
    res.status(400).json({ error: "El total del presupuesto no coincide con las cantidades." });
    return;
  }

  const [saved] = await db
    .insert(quoteRequestsTable)
    .values({
      id: randomUUID(),
      companyName: data.companyName.trim(),
      contactName: data.contactName.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || null,
      apartmentCount: data.apartmentCount ?? null,
      items: data.items,
      totalUnits: data.totalUnits,
      estimatedTotal: (requestedTotalInCents / 100).toFixed(2),
      notes: data.notes?.trim() || null,
    })
    .returning({
      id: quoteRequestsTable.id,
      receivedAt: quoteRequestsTable.receivedAt,
    });

  res
    .status(201)
    .json(SubmitQuoteResponse.parse({ id: saved.id, receivedAt: saved.receivedAt }));
});

export default router;
