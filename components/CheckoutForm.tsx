'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { CheckIcon, WhatsAppIcon } from '@/components/Icons';
import { BUSINESS, FIELD_LIMITS } from '@/lib/config';
import { useCartData } from '@/lib/cart';
import { buildOrderMessage, buildOrderUrl, validateCustomer } from '@/lib/whatsapp';
import type { CustomerErrors } from '@/lib/whatsapp';
import { track } from '@/lib/analytics';
import type { CustomerDetails } from '@/types';

const EMPTY: CustomerDetails = {
  nombre: '',
  telefono: '',
  direccion: '',
  referencia: '',
  nota: '',
};

export function CheckoutForm() {
  /** Los datos personales viven solo aquí, en memoria. Nunca en localStorage. */
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const firstErrorRef = useRef<string | null>(null);

  const { lines, subtotal, deliveryFee, total, count, orderType } = useCartData();
  const isDelivery = orderType === 'delivery';

  const payload = useMemo(
    () => ({ lines, subtotal, deliveryFee, total, orderType, customer }),
    [lines, subtotal, deliveryFee, total, orderType, customer],
  );

  const message = useMemo(() => buildOrderMessage(payload), [payload]);

  function update(field: keyof CustomerDetails, value: string) {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateCustomer(customer, orderType);
    setErrors(found);

    const firstError = (['nombre', 'telefono', 'direccion'] as const).find((key) => found[key]);
    if (firstError) {
      firstErrorRef.current = firstError;
      document.getElementById(firstError)?.focus();
      return;
    }

    track('whatsapp_order_click', { item_count: count, value: total });

    const url = buildOrderUrl(payload);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) setShowFallback(true);
    // El carrito NO se vacía: el pedido no está confirmado hasta que responda el restaurante.
  }

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4">
        <FormField
          id="nombre"
          label="Nombre"
          value={customer.nombre}
          onChange={(value) => update('nombre', value)}
          placeholder="Tu nombre"
          autoComplete="name"
          maxLength={FIELD_LIMITS.nombre}
          required
          error={errors.nombre}
        />
        <FormField
          id="telefono"
          label="Teléfono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={customer.telefono}
          onChange={(value) => update('telefono', value)}
          placeholder="809-000-0000"
          maxLength={FIELD_LIMITS.telefono}
          required
          error={errors.telefono}
        />
        {/* Dirección y referencia solo tienen sentido en delivery. En "Para
            llevar" no se piden ni se validan; el valor escrito se conserva
            por si la persona cambia de opinión. */}
        {isDelivery ? (
          <>
            <FormField
              id="direccion"
              label="Dirección de entrega"
              multiline
              value={customer.direccion}
              onChange={(value) => update('direccion', value)}
              placeholder="Calle, número y sector"
              maxLength={FIELD_LIMITS.direccion}
              required
              error={errors.direccion}
              hint="Mientras más clara, más rápido llega el pedido."
            />
            <FormField
              id="referencia"
              label="Referencia"
              optional
              value={customer.referencia}
              onChange={(value) => update('referencia', value)}
              placeholder="Casa azul, frente al colmado."
              maxLength={FIELD_LIMITS.referencia}
            />
          </>
        ) : null}
        <FormField
          id="nota"
          label="Nota para el pedido"
          optional
          multiline
          rows={2}
          value={customer.nota}
          onChange={(value) => update('nota', value)}
          placeholder="Sin cebolla, por favor."
          maxLength={FIELD_LIMITS.nota}
          hint="Una nota no cambia el precio del pedido."
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          className="inline-flex min-h-[54px] select-none items-center justify-center gap-2 rounded-md border border-[rgba(255,255,255,0.12)] bg-whatsapp px-6 font-ui text-base font-extrabold text-whatsapp-on shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.45),0_8px_22px_rgba(37,211,102,0.22)] transition-[transform,filter,box-shadow] duration-150 ease-premium hover:brightness-110 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <WhatsAppIcon size={22} />
          Enviar pedido por WhatsApp
        </button>
        <p className="text-[13px] leading-5 text-ink-muted">
          Se abrirá WhatsApp con tu pedido listo. {BUSINESS.name} confirmará la disponibilidad y
          el tiempo de entrega.
        </p>
      </div>

      {showFallback ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-[13px] leading-5 text-ink">
            No pudimos abrir WhatsApp. Copia el pedido y envíalo al{' '}
            <a
              href={BUSINESS.phoneHref}
              onClick={() => track('phone_click')}
              className="font-bold text-whatsapp underline-offset-2 hover:underline"
            >
              {BUSINESS.phoneDisplay}
            </a>
            .
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-bg-subtle p-3 font-ui text-[13px] leading-5 text-ink-muted">
            {message}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            onClick={copyOrder}
            icon={copied ? <CheckIcon size={16} className="text-state-success" /> : undefined}
          >
            {copied ? 'Pedido copiado' : 'Copiar pedido'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
