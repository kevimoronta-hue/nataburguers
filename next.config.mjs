/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        // Frames de la intro mobile: nombre versionado por carpeta
        // (sequence-mobile), nunca reescrito in situ. Si se regeneran con
        // otra calidad/recorte, publicar en sequence-mobile-v2/ y apuntar
        // el componente ahí — así el cache immutable nunca sirve un
        // archivo viejo bajo un nombre que cambió de contenido.
        source: '/sequence-mobile/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
