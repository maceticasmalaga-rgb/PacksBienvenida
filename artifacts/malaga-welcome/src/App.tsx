import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, Copy, Leaf, PackageCheck, ShieldCheck } from 'lucide-react';
import { useSubmitQuote } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { businessConfig } from './data/business';
import { combos, formatEuro, productById, products } from './data/catalog';

const queryClient = new QueryClient();
type Selection = { type: 'product' | 'combo'; id: string; name: string; quantity: number; unitPrice: number; units: number };

function Brand() {
  return <Link href="/" className="brand">MÁLAGA WELCOME<small>BIENVENIDAS CON DETALLE</small></Link>;
}

function Header() {
  return (
    <header className="container-wide topbar">
      <Brand />
      <nav className="navlinks" aria-label="Navegación principal">
        <a href="/#catalog">Packs</a><a href="/#combos">Combos</a><a href="/#approach">Nuestra forma de hacer</a>
        <a href="/#quote" className="btn">Solicitar presupuesto <ArrowRight size={14} /></a>
      </nav>
      <nav className="mobile-menu" aria-label="Navegación móvil">
        <a href="/#catalog">Packs</a><a href="/#quote">Presupuesto</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container-wide">
        <div className="footer-top">
          <div><Brand /><p className="footer-note">Packs de bienvenida e higiene para alojamientos turísticos en Málaga y Costa del Sol.</p></div>
          <div className="footer-links"><a href="/#catalog">Catálogo</a><a href="/#quote">Presupuestos</a><Link href="/aviso-legal">Aviso legal</Link><Link href="/privacidad">Privacidad</Link></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} MÁLAGA WELCOME</span><span>Precios con IVA incluido · Presupuestos no vinculantes</span></div>
      </div>
    </footer>
  );
}

function goToQuote() {
  document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getInventoryIssue(quantities: Record<string, number>) {
  for (const product of products) {
    if (product.stock === null) continue;
    const individualQuantity = quantities[`product:${product.id}`] || 0;
    const comboQuantity = combos.reduce((sum, combo) => {
      const productUnits = combo.composition.find((entry) => entry.productId === product.id)?.quantity ?? 0;
      return sum + (quantities[`combo:${combo.id}`] || 0) * productUnits;
    }, 0);
    if (individualQuantity + comboQuantity > product.stock) {
      return `La selección supera el inventario configurado de ${product.name} (${product.stock} unidades).`;
    }
  }
  for (const combo of combos) {
    const quantity = quantities[`combo:${combo.id}`] || 0;
    if (combo.stock !== null && quantity > combo.stock) {
      return `La selección supera el inventario configurado del combo ${combo.name} (${combo.stock} unidades).`;
    }
  }
  return '';
}

function Home() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectionNotice, setSelectionNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [form, setForm] = useState({ companyName: '', contactName: '', email: '', phone: '', apartmentCount: '', notes: '', privacyAccepted: false });
  const quoteMutation = useSubmitQuote();

  const selected = useMemo<Selection[]>(() => {
    const productSelections = products.flatMap((product) => {
      const quantity = Math.max(0, Math.floor(Number(quantities[`product:${product.id}`]) || 0));
      return quantity ? [{ type: 'product' as const, id: product.id, name: product.name, quantity, unitPrice: product.price, units: quantity }] : [];
    });
    const comboSelections = combos.flatMap((combo) => {
      const quantity = Math.max(0, Math.floor(Number(quantities[`combo:${combo.id}`]) || 0));
      return quantity ? [{ type: 'combo' as const, id: combo.id, name: `Combo ${combo.name}`, quantity, unitPrice: combo.price, units: combo.units * quantity }] : [];
    });
    return [...productSelections, ...comboSelections];
  }, [quantities]);

  const totalUnits = selected.reduce((sum, selection) => sum + selection.units, 0);
  const total = selected.reduce((sum, selection) => sum + selection.quantity * selection.unitPrice, 0);

  const setQuantity = (key: string, nextValue: number) => {
    const value = Number.isFinite(nextValue) ? Math.max(0, Math.min(9999, Math.floor(nextValue))) : 0;
    const nextQuantities = { ...quantities, [key]: value };
    const inventoryIssue = getInventoryIssue(nextQuantities);
    if (inventoryIssue) {
      setSelectionNotice(inventoryIssue);
      return false;
    }
    setQuantities(nextQuantities);
    setSelectionNotice('');
    return true;
  };

  const addProductToQuote = (id: string) => {
    const current = quantities[`product:${id}`] || 0;
    if (!setQuantity(`product:${id}`, current + 1)) return;
    setSelectionNotice(`${productById(id)?.name ?? 'Pack'} añadido a tu selección.`);
    goToQuote();
  };

  const addComboToQuote = (id: string) => {
    const current = quantities[`combo:${id}`] || 0;
    if (!setQuantity(`combo:${id}`, current + 1)) return;
    setSelectionNotice(`${combos.find((combo) => combo.id === id)?.name ?? 'Combo'} añadido a tu selección.`);
    goToQuote();
  };

  const sendWhatsAppMessage = async (message: string) => {
    if (businessConfig.whatsappNumber.trim()) {
      window.open(`https://wa.me/${businessConfig.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopyNotice('Mensaje copiado. Falta configurar el número de WhatsApp del negocio.');
    } catch {
      const temporaryField = document.createElement('textarea');
      temporaryField.value = message;
      temporaryField.style.position = 'fixed';
      temporaryField.style.opacity = '0';
      document.body.appendChild(temporaryField);
      temporaryField.select();
      const copied = document.execCommand('copy');
      temporaryField.remove();
      setCopyNotice(copied ? 'Mensaje copiado. Falta configurar el número de WhatsApp del negocio.' : 'Falta configurar el número de WhatsApp del negocio. Puedes seleccionar tus productos en el presupuesto.');
    }
    window.setTimeout(() => setCopyNotice(''), 6000);
  };

  const handleWhatsApp = (name: string, quantity: number, price: number) => {
    const message = `Hola, quisiera consultar disponibilidad y condiciones para ${quantity} × ${name} (${formatEuro(price)} por unidad; estimado ${formatEuro(quantity * price)}).`;
    void sendWhatsAppMessage(message);
  };

  const handleWhatsAppSelection = () => {
    if (!selected.length) return;
    const lines = selected.map((line) => `${line.quantity} × ${line.name}: ${formatEuro(line.quantity * line.unitPrice)}`);
    const message = [
      'Hola, quisiera solicitar información sobre esta selección:',
      ...lines,
      `Total estimado (${totalUnits} packs): ${formatEuro(total)} (IVA incluido).`,
      'Presupuesto no vinculante; cantidades, disponibilidad y precios sujetos a confirmación.',
    ].join('\n');
    void sendWhatsAppMessage(message);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.companyName.trim() || !form.contactName.trim() || !form.email.trim()) {
      setSelectionNotice('Completa los campos obligatorios de empresa, contacto y correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setSelectionNotice('Introduce un correo electrónico válido para recibir respuesta a tu solicitud.');
      return;
    }
    const apartmentCount = form.apartmentCount.trim() ? Number(form.apartmentCount) : null;
    if (apartmentCount !== null && (!Number.isInteger(apartmentCount) || apartmentCount < 0 || apartmentCount > 1000000)) {
      setSelectionNotice('Indica un número entero de apartamentos igual o superior a cero.');
      return;
    }
    if (!selected.length || totalUnits < 1) {
      setSelectionNotice('Selecciona al menos un producto o combo con cantidad mayor que cero.');
      return;
    }
    const inventoryIssue = getInventoryIssue(quantities);
    if (inventoryIssue) {
      setSelectionNotice(inventoryIssue);
      return;
    }
    if (!form.privacyAccepted) {
      setSelectionNotice('Confirma que has leído la información de privacidad antes de continuar.');
      return;
    }
    quoteMutation.mutate({
      data: {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        apartmentCount,
        items: selected.map((selection) => ({
          selectionType: selection.type,
          selectionId: selection.id,
          name: selection.name,
          quantity: selection.quantity,
          unitPrice: selection.unitPrice,
          lineTotal: Number((selection.quantity * selection.unitPrice).toFixed(2)),
        })),
        totalUnits,
        estimatedTotal: Number(total.toFixed(2)),
        notes: form.notes.trim() || null,
      },
    });
  };

  const setField = (field: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <>
      <Header />
      <main>
      <section className="hero">
          <div className="container-wide hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">Una bienvenida más cuidada</div>
              <h1>Una bienvenida que se nota.</h1>
              <p>Packs de higiene personal, prácticos y bien presentados, para quienes hacen de Málaga un lugar acogedor.</p>
              <a className="btn" href="/#catalog">Descubrir los packs <ArrowDownRight size={15} /></a>
              <div className="trustline"><span><i className="dot" />Pensados para apartamentos turísticos</span><span><i className="dot" />Precios con IVA incluido</span></div>
            </div>
            <div className="hero-art" role="img" aria-label="Packs de higiene para alojamientos turísticos" />
            <div className="hero-note">Un pequeño detalle. Una primera impresión más cálida.</div>
          </div>
        </section>

        <section className="section-pad" id="approach">
          <div className="container-wide intro-grid">
            <div><div className="eyebrow">La estancia empieza al llegar</div><h2>Todo listo para dar la bienvenida.</h2></div>
            <div className="intro-text">
              <p>Reunimos productos esenciales de higiene personal en packs listos para colocar, fáciles de gestionar y pensados para recibir a cada huésped.</p>
              <p><strong>Para gestores de apartamentos turísticos de Málaga y la Costa del Sol,</strong> es un detalle menos que coordinar y una bienvenida práctica desde el primer momento.</p>
            </div>
          </div>
        </section>

        <section className="section-pad benefits">
          <div className="container-wide">
            <div className="section-heading"><div className="eyebrow">Cuidamos los detalles</div><h2>La buena hospitalidad está en los pequeños gestos.</h2></div>
            <div className="benefit-grid">
              <article className="benefit"><span className="benefit-num">01</span><h3>Listos para la llegada</h3><p>Los packs ya preparados simplifican y hacen más uniforme la puesta a punto de cada apartamento.</p></article>
              <article className="benefit"><span className="benefit-num">02</span><h3>Elige tu bienvenida</h3><p>Cuatro packs, combos propuestos y un configurador de cantidades para tu negocio.</p></article>
              <article className="benefit"><span className="benefit-num">03</span><h3>Presentación cuidada</h3><p>Productos útiles presentados con atención al detalle para recibir bien a cada huésped.</p></article>
            </div>
          </div>
        </section>

        <section className="section-pad catalog" id="catalog">
          <div className="container-wide">
            <div className="section-heading center"><div className="eyebrow">Catálogo</div><h2>Encuentra el pack ideal.</h2><p>Cuatro opciones, desde los básicos hasta un set más completo. Precios por pack con IVA incluido.</p></div>
            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card" key={product.id} data-testid={`card-product-${product.id}`}>
                  <div className="product-image"><img src={product.image} alt={`${product.name} — ${product.displayName}`} width="900" height="1200" loading="lazy" /></div>
                  <div className="product-info">
                    <h3>{product.name}</h3><p>{product.composition}</p>
                    <div className="price-row"><div><span className="price">{formatEuro(product.price)}</span><span className="per-unit"> / pack</span></div></div>
                    <button className="tiny-action" type="button" onClick={() => addProductToQuote(product.id)} data-testid={`button-select-${product.id}`}>Añadir al presupuesto <ArrowRight size={13} /></button>
                    <button className="tiny-action" type="button" onClick={() => void handleWhatsApp(product.name, 1, product.price)} data-testid={`button-whatsapp-${product.id}`}>Consultar este pack</button>
                  </div>
                </article>
              ))}
            </div>
            {copyNotice && <div className="form-selection" role="status" data-testid="status-whatsapp">{copyNotice} <Copy size={13} /></div>}
          </div>
        </section>

        <section className="section-pad combo-section" id="combos">
          <div className="container-wide">
            <div className="section-heading"><div className="eyebrow">Combos sugeridos</div><h2>Una forma fácil de empezar.</h2><p>Precios con IVA incluido. Los importes promocionales son propuestas comerciales pendientes de confirmación.</p></div>
            <div className="combo-list">
              {combos.map((combo) => {
                const composition = combo.composition.map((entry) => `${entry.quantity} × ${productById(entry.productId)?.name ?? entry.productId}`).join(' · ');
                return <article className="combo-row" key={combo.id} data-testid={`card-combo-${combo.id}`}>
                  <div className="combo-title"><h3>Combo {combo.name}</h3><span>{combo.units} packs por combo</span></div>
                  <div className="combo-desc">{composition}</div>
                  <div className="combo-value">{formatEuro(combo.price)}<small>propuesta · IVA incl.</small></div>
                  <button className="btn btn-outline" type="button" onClick={() => addComboToQuote(combo.id)} data-testid={`button-combo-${combo.id}`}>Elegir combo</button>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section className="section-pad builder" id="builder">
          <div className="container-wide">
            <div className="section-heading center"><div className="eyebrow">Crea tu selección</div><h2>A tu medida.</h2><p>Elige cantidades de packs y combos para ver el total estimado y el número de unidades.</p></div>
            <div className="builder-layout">
              <div className="builder-list">
                <div className="eyebrow" style={{ padding: '16px 0' }}>Packs individuales</div>
                {products.map((product) => <div className="builder-item" key={product.id}>
                  <div><h3>{product.name}</h3><span>{formatEuro(product.price)} / pack</span></div>
                  <QuantityControl value={quantities[`product:${product.id}`] || 0} onChange={(value) => setQuantity(`product:${product.id}`, value)} label={`Cantidad de ${product.name}`} />
                </div>)}
                <div className="eyebrow" style={{ padding: '22px 0 16px' }}>Combos sugeridos</div>
                {combos.map((combo) => <div className="builder-item" key={combo.id}>
                  <div><h3>Combo {combo.name}</h3><span>{combo.units} packs · {formatEuro(combo.price)} / combo</span></div>
                  <QuantityControl value={quantities[`combo:${combo.id}`] || 0} onChange={(value) => setQuantity(`combo:${combo.id}`, value)} label={`Cantidad del combo ${combo.name}`} />
                </div>)}
              </div>
              <aside className="summary-card">
                <h3>Tu selección</h3>
                {selected.length ? selected.map((line) => <div className="summary-line" key={`${line.type}-${line.id}`}><span>{line.quantity} × {line.name}</span><strong>{formatEuro(line.quantity * line.unitPrice)}</strong></div>) : <div className="summary-line"><span>Aún no has seleccionado ningún producto</span><span>—</span></div>}
                <div className="summary-total"><span>{totalUnits} packs en total</span><strong>{formatEuro(total)}</strong></div>
                <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#77817d' }}>Total estimado · IVA incluido</span>
                <button type="button" className="btn" onClick={goToQuote} disabled={!selected.length}>Solicitar presupuesto <ArrowRight size={14} /></button>
                <button type="button" className="btn btn-outline" onClick={handleWhatsAppSelection} disabled={!selected.length}>Preparar mensaje de WhatsApp</button>
                <p className="summary-hint">Presupuesto no vinculante. Los precios de los combos son propuestas pendientes de confirmación.</p>
                {selectionNotice && <p role="status" className="form-error" data-testid="status-selection">{selectionNotice}</p>}
              </aside>
            </div>
          </div>
        </section>

        <section className="section-pad quote-section" id="quote">
          <div className="container-wide quote-layout">
            <aside className="quote-aside">
              <div className="eyebrow">Cuéntanos qué necesitas</div><h2>Hagamos más fácil cada llegada.</h2>
              <p>Comparte algunos datos y tu selección. Recibiremos tu solicitud de presupuesto no vinculante para revisarla contigo.</p>
              <p className="aside-note">Enviar esta solicitud no implica ningún compromiso. La disponibilidad y los precios finales de los combos deben confirmarse.</p>
            </aside>
            <div>
              {quoteMutation.isSuccess ? (
                <div className="form-success" role="status" data-testid="status-quote-success">
                  <h3>Solicitud recibida.</h3><p>La referencia de tu solicitud no vinculante es <strong>{quoteMutation.data.id}</strong>.</p>
                  <p>Recibida el {new Date(quoteMutation.data.receivedAt).toLocaleString('es-ES')}.</p>
                  <button type="button" className="btn btn-outline" onClick={() => quoteMutation.reset()}>Enviar otra solicitud</button>
                </div>
              ) : (
                <form className="quote-form" onSubmit={handleSubmit} noValidate>
                  <div className="form-grid">
                    <Field label="Empresa o actividad" id="companyName" required><input id="companyName" name="companyName" autoComplete="organization" required maxLength={160} value={form.companyName} onChange={(event) => setField('companyName', event.target.value)} data-testid="input-company-name" /></Field>
                    <Field label="Persona de contacto" id="contactName" required><input id="contactName" name="contactName" autoComplete="name" required maxLength={120} value={form.contactName} onChange={(event) => setField('contactName', event.target.value)} data-testid="input-contact-name" /></Field>
                    <Field label="Correo electrónico" id="email" required><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setField('email', event.target.value)} data-testid="input-email" /></Field>
                    <Field label="Teléfono comercial (opcional)" id="phone"><input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(event) => setField('phone', event.target.value)} data-testid="input-phone" /></Field>
                    <Field label="Apartamentos gestionados (opcional)" id="apartmentCount"><input id="apartmentCount" name="apartmentCount" type="number" min="0" max="1000000" step="1" value={form.apartmentCount} onChange={(event) => setField('apartmentCount', event.target.value)} data-testid="input-apartment-count" /></Field>
                    <Field label="Observaciones (opcional)" id="notes" full><textarea id="notes" name="notes" maxLength={2000} placeholder="Añade cualquier detalle útil sobre tu negocio." value={form.notes} onChange={(event) => setField('notes', event.target.value)} data-testid="input-notes" /></Field>
                  </div>
                  <div className="form-selection" data-testid="text-quote-summary">
                    <strong>{selected.length ? `${totalUnits} packs · ${formatEuro(total)} estimados` : 'Aún no has seleccionado ningún pack'}</strong>
                    {selected.map((line) => <div key={`${line.type}-${line.id}`}>{line.quantity} × {line.name} — {formatEuro(line.quantity * line.unitPrice)}</div>)}
                    <div>IVA incluido. Precios de combos pendientes de confirmación.</div>
                  </div>
                  <label className="checkbox-line"><input type="checkbox" checked={form.privacyAccepted} onChange={(event) => setField('privacyAccepted', event.target.checked)} required data-testid="input-privacy-consent" />He leído la <Link href="/privacidad">información de privacidad</Link> y autorizo el envío de estos datos para esta solicitud.</label>
                  {selectionNotice && <p className="form-error" role="alert">{selectionNotice}</p>}
                  {quoteMutation.isError && <p className="form-error" role="alert" data-testid="status-quote-error">No se ha podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.</p>}
                  <button type="submit" className="btn" disabled={quoteMutation.isPending || !selected.length} data-testid="button-submit-quote">
                    {quoteMutation.isPending ? 'Enviando solicitud…' : 'Enviar solicitud no vinculante'} {quoteMutation.isPending ? <span aria-hidden="true">…</span> : <ArrowRight size={14} />}
                  </button>
                  <p className="summary-hint" style={{ textAlign: 'left' }}>La solicitud no es vinculante. El precio final y la disponibilidad deben confirmarse.</p>
                </form>
              )}
            </div>
          </div>
        </section>
        <section className="section-pad benefits" style={{ paddingBlock: 42 }}>
          <div className="container-wide" style={{ display: 'flex', justifyContent: 'center', gap: 36, flexWrap: 'wrap', color: '#52645c', fontSize: 11 }}>
            <span><PackageCheck size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />Packs para alojamientos turísticos</span>
            <span><Leaf size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />Una bienvenida cuidada y práctica</span>
            <span><ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />Presupuestos claros y sin compromiso</span>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function QuantityControl({ value, onChange, label }: { value: number; onChange: (quantity: number) => void; label: string }) {
  return <div className="quantity-control">
    <button type="button" aria-label={`Reducir ${label}`} onClick={() => onChange(Math.max(0, value - 1))} data-testid={`button-decrease-${label.replaceAll(' ', '-')}`}>−</button>
    <input type="number" min="0" max="9999" aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))} data-testid={`input-quantity-${label.replaceAll(' ', '-')}`} />
    <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(Math.min(9999, value + 1))} data-testid={`button-increase-${label.replaceAll(' ', '-')}`}>+</button>
  </div>;
}

function Field({ label, id, required, full, children }: { label: string; id: string; required?: boolean; full?: boolean; children: ReactNode }) {
  return <div className={`field${full ? ' full' : ''}`}><label htmlFor={id}>{label}{required ? ' *' : ''}</label>{children}</div>;
}

function LegalPage({ privacy = false }: { privacy?: boolean }) {
  const title = privacy ? 'Información de privacidad' : 'Aviso legal';
  useEffect(() => {
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    document.title = `${title} | MÁLAGA WELCOME`;
    if (description) {
      description.content = privacy
        ? 'Información provisional sobre los datos enviados al solicitar presupuestos a MÁLAGA WELCOME.'
        : 'Aviso legal provisional de MÁLAGA WELCOME. Los datos de la empresa responsable y el texto definitivo están pendientes.';
    }
    return () => {
      document.title = 'Packs de bienvenida en Málaga | MÁLAGA WELCOME';
      if (description && previousDescription) description.content = previousDescription;
    };
  }, [privacy, title]);
  return <div className="legal-page"><Header /><main className="container-wide legal-content">
    <Link href="/" className="legal-back">← Volver a MÁLAGA WELCOME</Link>
    <div className="eyebrow" style={{ marginTop: 34 }}>MÁLAGA WELCOME · {privacy ? 'PRIVACIDAD' : 'AVISO LEGAL'}</div>
    <h1>{title}</h1>
    <div className="pending-box"><strong>Faltan los datos de la empresa y la revisión legal.</strong><br />Esta página es un borrador. Antes de publicarla, hay que completar y revisar los datos de la empresa responsable y el texto legal definitivo.</div>
    {privacy ? <>
      <h2>¿Quién es responsable?</h2><p>Aún no se han facilitado la identidad legal, el domicilio ni el canal de contacto de la persona responsable del tratamiento. Es necesario completar estos datos antes de utilizar este aviso.</p>
      <h2>Datos enviados a través de esta web</h2><p>Al solicitar un presupuesto, los datos facilitados —empresa, persona de contacto, correo electrónico, teléfono opcional, número de apartamentos, productos elegidos y observaciones— quedan guardados en el sistema para que la empresa pueda consultar la solicitud y gestionarla.</p>
      <h2>Finalidad y base jurídica</h2><p>La finalidad, la base jurídica aplicable, el plazo de conservación, los destinatarios, los proveedores que puedan tratar los datos y las transferencias internacionales deben confirmarse con la empresa responsable y someterse a revisión legal.</p>
      <h2>Tus derechos</h2><p>La información sobre cómo ejercer los derechos aplicables en materia de protección de datos y la autoridad de control correspondiente debe completarse cuando se confirmen los datos de contacto y los procesos de tratamiento.</p>
    </> : <>
      <h2>Identificación de la empresa</h2><p>Quedan pendientes de confirmación la razón social, el NIF, el domicilio, los datos registrales y la información de contacto de la empresa que opera MÁLAGA WELCOME.</p>
      <h2>Finalidad de la web</h2><p>Esta web presenta packs de bienvenida e higiene personal para gestores de apartamentos turísticos y permite enviar solicitudes de presupuesto no vinculantes. Los precios indicados incluyen IVA; los precios de los combos son propuestas pendientes de confirmación.</p>
      <h2>Condiciones y propiedad intelectual</h2><p>Antes de publicar, la empresa debe completar y revisar las condiciones de uso, la disponibilidad de los productos, los permisos de uso de las imágenes, la información de propiedad intelectual y cualquier otro aviso aplicable.</p>
    </>}
    <div className="pending-box">Datos de contacto de la empresa: pendientes de configuración. Este borrador no sustituye a un aviso legal definitivo ni a una revisión jurídica.</div>
  </main><Footer /></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Home} />
    <Route path="/aviso-legal"><LegalPage /></Route>
    <Route path="/privacidad"><LegalPage privacy /></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster />
  </TooltipProvider></QueryClientProvider>;
}

export default App;
