import { CartBar } from '@/components/CartBar';
import { CartDrawer } from '@/components/CartDrawer';
import { CartRoot } from '@/components/CartRoot';
import { CategoryNav } from '@/components/CategoryNav';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { LocationSection } from '@/components/LocationSection';
import { MenuSections } from '@/components/MenuSection';
import { MobileFrameSequenceIntro } from '@/components/MobileFrameSequenceIntro';
import { BUSINESS, SITE_URL } from '@/lib/config';
import { PRODUCTS } from '@/data/menu';

/**
 * Datos estructurados limitados a lo confirmado: nombre, dirección,
 * teléfono, moneda y el menú real. Sin horarios, sin coordenadas,
 * sin valoraciones, sin zona de reparto.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: BUSINESS.name,
  url: SITE_URL,
  telephone: '+1-809-685-9204',
  servesCuisine: 'Comida rápida',
  priceRange: 'RD$75 - RD$450',
  currenciesAccepted: 'DOP',
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address,
    addressCountry: 'DO',
  },
  hasMenu: {
    '@type': 'Menu',
    name: 'Menú Nata Burger’s',
    hasMenuSection: [
      { id: 'hamburguesas', name: 'Hamburguesas' },
      { id: 'pechurina', name: 'Pechurina' },
      { id: 'club-sandwich', name: 'Club Sandwich' },
      { id: 'batidas', name: 'Batidas' },
      { id: 'jugos-naturales', name: 'Jugos Naturales' },
    ].map((section) => ({
      '@type': 'MenuSection',
      name: section.name,
      hasMenuItem: PRODUCTS.filter((product) => product.category === section.id).map(
        (product) => ({
          '@type': 'MenuItem',
          name: product.name,
          ...(product.description ? { description: product.description } : {}),
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'DOP',
          },
        }),
      ),
    })),
  },
};

export default function HomePage() {
  return (
    <CartRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <MobileFrameSequenceIntro />

      <Header />

      <main id="main-content" className="site-main pb-24 lg:pb-0">
        <Hero />

        <div id="menu" className="scroll-mt-[150px]">
          <CategoryNav />
          <MenuSections />
        </div>

        <LocationSection />
      </main>

      <Footer />

      <CartBar />
      <CartDrawer />
    </CartRoot>
  );
}
