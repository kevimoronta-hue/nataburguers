'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Embers } from '@/components/Embers';
import { MopedIcon, WhatsAppIcon } from '@/components/Icons';
import { BUSINESS, whatsappLink } from '@/lib/config';
import { track } from '@/lib/analytics';

/**
 * El hero se arma al cargar — las capas entran y se asientan — y al
 * empezar a hacer scroll se cierra suavemente hacia el menú.
 * Nunca secuestra el scroll: el movimiento solo lee su posición.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    function update() {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const height = el.offsetHeight || 1;
      // Progreso = cuánto ha salido el hero por arriba del viewport.
      // En desktop el hero es el primer bloque del documento, así que
      // -rect.top === window.scrollY (resultado idéntico al de antes). En
      // mobile, con la intro de 450vh delante, esto evita que el hero se
      // dé por "asentado" desde el primer pixel de scroll y evita renders
      // por frame mientras aún está fuera de pantalla (progress se queda en 0).
      const top = el.getBoundingClientRect().top;
      setProgress(Math.min(Math.max(-top / height, 0), 1));
    }
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const settle = reduced ? 0 : progress;

  return (
    <section
      ref={ref}
      id="inicio"
      className="relative overflow-hidden bg-bg-base pb-10 pt-[136px] sm:pt-[152px] lg:pb-16 lg:pt-[168px]"
    >
      <Embers />

      <div className="relative mx-auto grid max-w-shell items-center gap-8 px-4 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:px-6">
        <div
          className="animate-fade-up motion-reduce:animate-none"
          style={{ animationDelay: '0.1s' }}
        >
          <p className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-brand">
            {BUSINESS.tagline}
          </p>
          <h1 className="mt-3 font-display text-[44px] uppercase leading-[0.94] tracking-[-0.01em] text-ink sm:text-[56px]">
            Tu antojo empieza aquí.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[26px] text-ink-muted">
            Elige tus favoritos, arma tu pedido y envíalo directamente por WhatsApp.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" href="#menu">
              Ver el menú
            </Button>
            <Button
              variant="secondary"
              size="lg"
              href={whatsappLink(
                `Hola ${BUSINESS.name}, quisiera hacer un pedido.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              icon={<WhatsAppIcon size={18} className="text-whatsapp" />}
              onClick={() => track('phone_click')}
            >
              Pedir por WhatsApp
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 rounded-pill border border-line-brand bg-surface px-4 py-2 text-[13px] font-bold text-ink">
              <MopedIcon size={18} className="text-brand" />
              Envío {BUSINESS.currency}
              {BUSINESS.deliveryFee}
            </span>
            <p className="text-[13px] leading-5 text-ink-muted">
              Confirmamos disponibilidad y tiempo de entrega por WhatsApp.
            </p>
          </div>
        </div>

        {/* Composición del burger */}
        <div
          className="relative mx-auto w-full max-w-[420px] lg:max-w-none"
          style={{
            transform: `translate3d(0, ${settle * -18}px, 0) scale(${1 - settle * 0.06})`,
            opacity: 1 - settle * 0.35,
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-6 bottom-4 h-16 rounded-full bg-brand-deep opacity-50 blur-3xl"
          />
          <div
            className="relative animate-stack-settle overflow-hidden rounded-xl motion-reduce:animate-none"
            style={{ ['--stack-from' as string]: '26px', animationDelay: '0.05s' }}
          >
            <Image
              src="/images/hamburguesa-clasica.png"
              alt="Hamburguesa Clásica de Nata Burger's con doble queso y tocino, servida con papas fritas"
              width={1200}
              height={900}
              priority
              sizes="(min-width: 1024px) 520px, 92vw"
              className="h-auto w-full object-cover"
            />
            {/* Barrido de luz cálida al montarse */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-light-sweep bg-gradient-to-r from-transparent via-[rgba(255,241,214,0.35)] to-transparent motion-reduce:hidden"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
