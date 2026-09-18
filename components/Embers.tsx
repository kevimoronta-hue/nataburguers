/**
 * Ambiente de fondo: calor naranja difuso, textura de parrilla muy tenue
 * y unas pocas brasas que suben despacio. Puramente decorativo, sin
 * JavaScript y sin vídeo: no compite con la velocidad del pedido.
 * Bajo prefers-reduced-motion las brasas se quedan quietas.
 */

const EMBERS = [
  { left: '8%', bottom: '-12%', size: 4, delay: '0s', duration: '9s', opacity: 0.55 },
  { left: '19%', bottom: '-8%', size: 3, delay: '1.8s', duration: '11s', opacity: 0.4 },
  { left: '31%', bottom: '-16%', size: 5, delay: '3.4s', duration: '8.5s', opacity: 0.5 },
  { left: '46%', bottom: '-10%', size: 3, delay: '0.9s', duration: '12s', opacity: 0.35 },
  { left: '58%', bottom: '-14%', size: 4, delay: '5.2s', duration: '10s', opacity: 0.45 },
  { left: '71%', bottom: '-9%', size: 3, delay: '2.6s', duration: '9.5s', opacity: 0.4 },
  { left: '83%', bottom: '-13%', size: 5, delay: '4.1s', duration: '11.5s', opacity: 0.5 },
  { left: '92%', bottom: '-7%', size: 3, delay: '6.3s', duration: '10.5s', opacity: 0.3 },
];

export function Embers() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Calor naranja difuso */}
      <div
        className="absolute -left-1/4 top-0 h-[520px] w-[720px] rounded-full opacity-40 blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, #8f2d00, transparent)' }}
      />
      <div
        className="absolute -right-24 top-32 h-[420px] w-[520px] rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(closest-side, #d94300, transparent)' }}
      />

      {/* Textura de parrilla, al 8% como máximo */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,241,214,0.5) 0 1px, transparent 1px 34px)',
          maskImage: 'linear-gradient(180deg, transparent, #000 35%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 35%, transparent)',
        }}
      />

      {/* Brasas */}
      {EMBERS.map((ember, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-brand-bright animate-ember-rise motion-reduce:animate-none motion-reduce:opacity-30"
          style={{
            left: ember.left,
            bottom: ember.bottom,
            width: ember.size,
            height: ember.size,
            animationDelay: ember.delay,
            ['--ember-duration' as string]: ember.duration,
            boxShadow: `0 0 ${ember.size * 3}px rgba(255,116,23,${ember.opacity})`,
          }}
        />
      ))}
    </div>
  );
}
