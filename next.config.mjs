/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep firebase-admin out of the webpack bundle so its WASM/proto files
  // survive Vercel's serverless tracing (bundling it crashes the API routes
  // on Vercel with 500s while working fine locally).
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
