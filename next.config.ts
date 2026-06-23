import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pdf-parse depends on pdfjs-dist which spawns a worker and looks for its
  // own file via __filename-relative paths. Bundling breaks those paths.
  // Marking both packages as external keeps them in node_modules at runtime.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
}

export default nextConfig
