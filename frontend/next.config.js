/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production'
      ? 'https://grc-api-dev.saaim-khan.workers.dev'
      : 'https://grc-api-dev.saaim-khan.workers.dev'
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://grc-api-dev.saaim-khan.workers.dev/api/:path*'
      }
    ]
  }
}

export default nextConfig
