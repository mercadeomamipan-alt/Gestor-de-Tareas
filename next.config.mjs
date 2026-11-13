/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite subir adjuntos de hasta 10 MB desde los formularios
    serverActions: { bodySizeLimit: "11mb" },
  },
};
export default nextConfig;
