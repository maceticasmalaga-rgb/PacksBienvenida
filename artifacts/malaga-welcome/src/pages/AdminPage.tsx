import { type FormEvent, useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type AdminQuote,
  type AdminQuoteUpdate,
  type QuoteStatus,
  useListAdminQuotes,
  useUpdateAdminQuote,
} from "@workspace/api-client-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const statusLabels: Record<QuoteStatus, string> = {
  new: "Nueva",
  pending_contact: "Pendiente de contactar",
  quote_sent: "Presupuesto enviado",
  negotiating: "En negociación",
  accepted: "Aceptada",
  rejected: "Rechazada",
  completed: "Completada",
};

const emailStatusLabels = {
  not_configured: "Sin configurar",
  sent: "Enviado",
  failed: "Fallido",
} as const;

const formatEuro = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function quoteParams(search: string, status: string, page: number) {
  return {
    q: search.trim() || undefined,
    status: status === "all" ? undefined : (status as QuoteStatus),
    page,
    pageSize: 25,
  };
}

function QuoteCard({
  quote,
  isSaving,
  onSave,
}: {
  quote: AdminQuote;
  isSaving: boolean;
  onSave: (id: string, data: AdminQuoteUpdate) => void;
}) {
  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [adminNotes, setAdminNotes] = useState(quote.adminNotes ?? "");
  const [lastContactAt, setLastContactAt] = useState(
    toLocalInput(quote.lastContactAt),
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    toLocalInput(quote.nextFollowUpAt),
  );
  const [finalSaleAmount, setFinalSaleAmount] = useState(
    quote.finalSaleAmount === null ? "" : String(quote.finalSaleAmount),
  );

  useEffect(() => {
    setStatus(quote.status);
    setAdminNotes(quote.adminNotes ?? "");
    setLastContactAt(toLocalInput(quote.lastContactAt));
    setNextFollowUpAt(toLocalInput(quote.nextFollowUpAt));
    setFinalSaleAmount(
      quote.finalSaleAmount === null ? "" : String(quote.finalSaleAmount),
    );
  }, [quote]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(quote.id, {
      status,
      adminNotes: adminNotes.trim() || null,
      lastContactAt: fromLocalInput(lastContactAt),
      nextFollowUpAt: fromLocalInput(nextFollowUpAt),
      finalSaleAmount:
        finalSaleAmount.trim() === "" ? null : Number(finalSaleAmount),
    });
  };

  return (
    <article className="admin-quote-card" data-testid={`admin-quote-${quote.id}`}>
      <div className="admin-quote-heading">
        <div>
          <div className="admin-eyebrow">Referencia · {quote.id}</div>
          <h2>{quote.companyName}</h2>
          <p>
            {quote.contactName} · {new Date(quote.receivedAt).toLocaleString("es-ES")}
          </p>
        </div>
        <span className={`admin-status admin-status-${quote.status}`}>
          {statusLabels[quote.status]}
        </span>
      </div>

      <div className="admin-quote-details">
        <section>
          <h3>Contacto y solicitud</h3>
          <p>
            <a href={`mailto:${quote.email}`}>{quote.email}</a>
            {quote.phone && (
              <>
                <br />
                <a href={`tel:${quote.phone}`}>{quote.phone}</a>
              </>
            )}
          </p>
          <p>
            {quote.apartmentCount === null
              ? "Alojamientos: no indicado"
              : `Alojamientos: ${quote.apartmentCount}`}
          </p>
          {quote.notes && <p className="admin-customer-note">{quote.notes}</p>}
        </section>

        <section>
          <h3>Productos y cantidades</h3>
          <ul className="admin-items">
            {quote.items.map((item) => (
              <li key={`${item.selectionType}-${item.selectionId}`}>
                <span>
                  {item.quantity} × {item.name}
                  {item.selectionType === "combo" && (
                    <small> · {item.units} unidades incluidas por combo</small>
                  )}
                </span>
                <strong>{formatEuro(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          <div className="admin-financials">
            <div>
              <span>Unidades individuales</span>
              <strong>{quote.individualUnits}</strong>
            </div>
            <div>
              <span>Unidades totales</span>
              <strong>{quote.totalUnits}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{formatEuro(quote.subtotal)}</strong>
            </div>
            <div>
              <span>Descuento individual</span>
              <strong>−{formatEuro(quote.discountTotal)}</strong>
            </div>
            <div className="admin-financial-total">
              <span>Total estimado</span>
              <strong>{formatEuro(quote.estimatedTotal)}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-delivery-status">
        <span>
          Aviso al negocio: {emailStatusLabels[quote.businessEmailStatus]}
        </span>
        <span>
          Confirmación al cliente: {emailStatusLabels[quote.customerEmailStatus]}
        </span>
      </div>

      <form className="admin-follow-up" onSubmit={save}>
        <h3>Gestión privada</h3>
        <div className="admin-edit-grid">
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QuoteStatus)}
              data-testid={`select-status-${quote.id}`}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Último contacto
            <input
              type="datetime-local"
              value={lastContactAt}
              onChange={(event) => setLastContactAt(event.target.value)}
              data-testid={`input-last-contact-${quote.id}`}
            />
          </label>
          <label>
            Próximo seguimiento
            <input
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              data-testid={`input-follow-up-${quote.id}`}
            />
          </label>
          <label>
            Importe final de venta (€)
            <input
              type="number"
              min="0"
              step="0.01"
              value={finalSaleAmount}
              onChange={(event) => setFinalSaleAmount(event.target.value)}
              data-testid={`input-final-sale-${quote.id}`}
            />
          </label>
          <label className="admin-notes-field">
            Notas privadas
            <textarea
              maxLength={5000}
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              data-testid={`textarea-admin-notes-${quote.id}`}
            />
          </label>
        </div>
        <button
          className="btn"
          type="submit"
          disabled={isSaving}
          data-testid={`button-save-admin-quote-${quote.id}`}
        >
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </article>
  );
}

export default function AdminPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [saveError, setSaveError] = useState("");
  const params = quoteParams(search, status, page);
  const quotesQuery = useListAdminQuotes(params);
  const updateQuote = useUpdateAdminQuote({
    mutation: {
      onSuccess: async () => {
        setSaveError("");
        await queryClient.invalidateQueries();
      },
      onError: () =>
        setSaveError("No se pudieron guardar los cambios. Inténtalo de nuevo."),
    },
  });

  const exportParams = new URLSearchParams();
  if (params.q) exportParams.set("q", params.q);
  if (params.status) exportParams.set("status", params.status);
  const exportHref = `/api/admin/quotes/export.csv?${exportParams.toString()}`;

  const save = (id: string, data: AdminQuoteUpdate) => {
    setSaveError("");
    updateQuote.mutate({ id, data });
  };

  const handleSignOut = async () => {
    await signOut({ redirectUrl: basePath || "/" });
  };

  const statusCounts = quotesQuery.data?.statusCounts ?? [];
  const total = quotesQuery.data?.total ?? 0;
  const currentPage = quotesQuery.data?.page ?? page;
  const totalPages = quotesQuery.data?.totalPages ?? 0;

  return (
    <main className="admin-page">
      <div className="admin-topbar">
        <Link className="admin-brand" href="/">
          MÁLAGA WELCOME <span>Administración</span>
        </Link>
        <div className="admin-account">
          <span>{user?.primaryEmailAddress?.emailAddress}</span>
          <button type="button" className="btn btn-outline" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-page-heading">
          <div>
            <div className="admin-eyebrow">PANEL PRIVADO</div>
            <h1>Solicitudes de presupuesto</h1>
            <p>Consulta solicitudes, registra el seguimiento y actualiza su estado.</p>
          </div>
          <a className="btn btn-outline" href={exportHref} data-testid="button-export-csv">
            Exportar CSV
          </a>
        </div>

        <section className="admin-summary" aria-label="Resumen de resultados">
          <div className="admin-result-total">
            <strong>{total}</strong>
            <span>{total === 1 ? "solicitud" : "solicitudes"}</span>
          </div>
          {statusCounts.map(({ status: quoteStatus, count }) => (
            <div className="admin-result-status" key={quoteStatus}>
              <span>{statusLabels[quoteStatus]}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </section>

        <section className="admin-filters" aria-label="Búsqueda y filtros">
          <label>
            Buscar
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Referencia, empresa, persona, correo o teléfono"
              data-testid="input-admin-search"
            />
          </label>
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              data-testid="select-admin-status-filter"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {saveError && <p className="admin-alert" role="alert">{saveError}</p>}
        {quotesQuery.isLoading && <p className="admin-empty">Cargando solicitudes…</p>}
        {quotesQuery.isError && (
          <div className="admin-alert" role="alert">
            <strong>No se pudieron cargar las solicitudes.</strong>
            <p>
              Comprueba que tu cuenta esté autorizada para este panel y que el
              correo de administración esté configurado.
            </p>
          </div>
        )}
        {quotesQuery.isSuccess && total === 0 && (
          <p className="admin-empty">No hay solicitudes que coincidan con estos filtros.</p>
        )}
        {quotesQuery.data?.quotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            isSaving={updateQuote.isPending}
            onSave={save}
          />
        ))}

        {totalPages > 1 && (
          <nav className="admin-pagination" aria-label="Paginación de solicitudes">
            <button
              className="btn btn-outline"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              className="btn btn-outline"
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
