import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  quoteRequestsTable,
  type QuoteItem,
} from "@workspace/db";
import {
  ListAdminQuotesQueryParams,
  ListAdminQuotesResponse,
  UpdateAdminQuoteBody,
  UpdateAdminQuoteParams,
  UpdateAdminQuoteResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const statuses = [
  "new",
  "pending_contact",
  "quote_sent",
  "negotiating",
  "accepted",
  "rejected",
  "completed",
] as const;
type QuoteStatus = (typeof statuses)[number];

function money(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAdminQuote(row: typeof quoteRequestsTable.$inferSelect) {
  return {
    id: row.id,
    companyName: row.companyName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    apartmentCount: row.apartmentCount,
    items: (row.items as QuoteItem[]).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      discount: Number(item.discount),
      lineTotal: Number(item.lineTotal),
    })),
    individualUnits: row.individualUnits,
    totalUnits: row.totalUnits,
    subtotal: money(row.subtotal) ?? 0,
    discountTotal: money(row.discountTotal) ?? 0,
    estimatedTotal: money(row.estimatedTotal) ?? 0,
    notes: row.notes,
    status: row.status as QuoteStatus,
    adminNotes: row.adminNotes,
    lastContactAt: row.lastContactAt?.toISOString() ?? null,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
    finalSaleAmount: money(row.finalSaleAmount),
    businessEmailStatus: row.businessEmailStatus,
    customerEmailStatus: row.customerEmailStatus,
    receivedAt: row.receivedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function quoteWhere(search: string | undefined, status: string | undefined): SQL | undefined {
  const conditions: SQL[] = [];
  if (status) {
    conditions.push(eq(quoteRequestsTable.status, status));
  }

  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const searchMatch = or(
      sql`${quoteRequestsTable.id}::text ILIKE ${pattern}`,
      ilike(quoteRequestsTable.companyName, pattern),
      ilike(quoteRequestsTable.contactName, pattern),
      ilike(quoteRequestsTable.email, pattern),
      ilike(quoteRequestsTable.phone, pattern),
      ilike(quoteRequestsTable.notes, pattern),
      ilike(quoteRequestsTable.adminNotes, pattern),
    );
    if (searchMatch) conditions.push(searchMatch);
  }

  return conditions.length ? and(...conditions) : undefined;
}

async function filteredQuotes(where: SQL | undefined) {
  return db
    .select()
    .from(quoteRequestsTable)
    .where(where)
    .orderBy(desc(quoteRequestsTable.receivedAt));
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function csvForQuote(row: ReturnType<typeof toAdminQuote>) {
  const itemSummary = row.items
    .map((item) => `${item.quantity} x ${item.name} (${item.lineTotal.toFixed(2)} €)`)
    .join(" | ");
  return [
    row.id,
    row.receivedAt,
    row.contactName,
    row.companyName,
    row.email,
    row.phone,
    row.apartmentCount,
    itemSummary,
    row.individualUnits,
    row.totalUnits,
    row.subtotal.toFixed(2),
    row.discountTotal.toFixed(2),
    row.estimatedTotal.toFixed(2),
    row.status,
    row.adminNotes,
    row.lastContactAt,
    row.nextFollowUpAt,
    row.finalSaleAmount?.toFixed(2),
    row.businessEmailStatus,
    row.customerEmailStatus,
  ]
    .map(csvCell)
    .join(",");
}

router.get("/admin/quotes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminQuotesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Los filtros no son válidos." });
    return;
  }

  const { q, status, page, pageSize } = parsed.data;
  const where = quoteWhere(q, status);
  const [rows, countResult, counts] = await Promise.all([
    db
      .select()
      .from(quoteRequestsTable)
      .where(where)
      .orderBy(desc(quoteRequestsTable.receivedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(quoteRequestsTable)
      .where(where),
    db
      .select({
        status: quoteRequestsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(quoteRequestsTable)
      .where(where)
      .groupBy(quoteRequestsTable.status),
  ]);
  const total = Number(countResult[0]?.count ?? 0);

  res.json(
    ListAdminQuotesResponse.parse({
      quotes: rows.map(toAdminQuote),
      statusCounts: statuses.map((quoteStatus) => ({
        status: quoteStatus,
        count: Number(
          counts.find((entry) => entry.status === quoteStatus)?.count ?? 0,
        ),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }),
  );
});

router.get(
  "/admin/quotes/export.csv",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminQuotesQueryParams.pick({
      q: true,
      status: true,
    }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Los filtros no son válidos." });
      return;
    }

    const rows = await filteredQuotes(quoteWhere(parsed.data.q, parsed.data.status));
    const headers = [
      "Referencia",
      "Fecha",
      "Cliente",
      "Empresa",
      "Correo",
      "Teléfono",
      "Alojamientos",
      "Productos y cantidades",
      "Unidades individuales",
      "Unidades totales",
      "Subtotal EUR",
      "Descuento EUR",
      "Total estimado EUR",
      "Estado",
      "Notas privadas",
      "Último contacto",
      "Próximo seguimiento",
      "Importe final EUR",
      "Aviso al negocio",
      "Confirmación al cliente",
    ];
    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => csvForQuote(toAdminQuote(row))),
    ].join("\r\n");

    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="malaga-welcome-presupuestos-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      })
      .send(`\uFEFF${csv}`);
  },
);

router.patch(
  "/admin/quotes/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsedParams = UpdateAdminQuoteParams.safeParse(req.params);
    const parsedBody = UpdateAdminQuoteBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "La actualización no es válida." });
      return;
    }
    if (Object.keys(parsedBody.data).length === 0) {
      res.status(400).json({ error: "Indica al menos un dato para actualizar." });
      return;
    }

    const input = parsedBody.data;
    const updates: Partial<typeof quoteRequestsTable.$inferInsert> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.adminNotes !== undefined) {
      updates.adminNotes = input.adminNotes?.trim() || null;
    }
    if (input.lastContactAt !== undefined) {
      updates.lastContactAt = input.lastContactAt;
    }
    if (input.nextFollowUpAt !== undefined) {
      updates.nextFollowUpAt = input.nextFollowUpAt;
    }
    if (input.finalSaleAmount !== undefined) {
      updates.finalSaleAmount =
        input.finalSaleAmount === null
          ? null
          : input.finalSaleAmount.toFixed(2);
    }

    const [updated] = await db
      .update(quoteRequestsTable)
      .set(updates)
      .where(eq(quoteRequestsTable.id, parsedParams.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "No se encontró la solicitud." });
      return;
    }

    res.json(UpdateAdminQuoteResponse.parse(toAdminQuote(updated)));
  },
);

export default router;
