/** @type {import('next').NextConfig} */
const nextConfig = { images: { formats: ['image/avif', 'image/webp'], remotePatterns:[{protocol:'https',hostname:'kjappapp.no',pathname:'/assets/figma/**'}] } };
export default nextConfig;
