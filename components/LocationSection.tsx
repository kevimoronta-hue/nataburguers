'use client';

import { InfoBar } from '@/components/InfoBar';
import { MopedIcon, PinIcon, WhatsAppIcon } from '@/components/Icons';
import { SectionHeading } from '@/components/SectionHeading';
import { BUSINESS } from '@/lib/config';
import { track } from '@/lib/analytics';

export function LocationSection() {
  return (
    <>
      <div className="mx-auto max-w-shell px-4 pb-10 lg:px-6">
        <InfoBar tone="brand" icon={<MopedIcon size={26} />}>
          ${BUSINESS.deliveryFee} por envío
        </InfoBar>
      </div>

      <section id="ubicacion" className="scroll-mt-[150px] bg-bg-subtle py-10 lg:py-16">
        <div className="mx-auto flex max-w-shell flex-col gap-6 px-4 lg:px-6">
          <SectionHeading>Ubicación</SectionHeading>
          <div className="grid gap-3 sm:max-w-[620px]">
            <a
              href={BUSINESS.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir la ubicación de Nata Burger's en Google Maps"
              className="flex min-h-[44px] items-center gap-3 rounded-pill border border-line bg-surface px-5 py-4 text-ink no-underline transition-colors duration-150 hover:border-line-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none"
            >
              <span className="inline-flex shrink-0 text-brand">
                <PinIcon size={20} />
              </span>
              <span className="text-[15px] leading-[23px]">{BUSINESS.address}</span>
            </a>
            <a
              href={BUSINESS.phoneHref}
              onClick={() => track('phone_click')}
              className="flex items-center gap-3 rounded-pill border border-line bg-surface px-5 py-4 text-ink no-underline transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none"
            >
              <WhatsAppIcon size={20} className="shrink-0 text-whatsapp" />
              <span className="text-[15px] leading-[23px]">
                Envío a domicilio ·{' '}
                <span className="font-bold">{BUSINESS.phoneDisplay}</span>
              </span>
            </a>
          </div>
          <p className="max-w-[60ch] text-[13px] leading-5 text-ink-muted">
            Confirmamos disponibilidad y tiempo de entrega por WhatsApp.
          </p>
        </div>
      </section>
    </>
  );
}
