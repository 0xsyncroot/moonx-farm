/** @type {import('next').NextConfig} */
const TerserPlugin = require('terser-webpack-plugin');

const nextConfig = {
  output: 'standalone',

  swcMinify: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  transpilePackages: ['@moonx-farm/common', '@moonx-farm/configs'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        port: '',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };

    if (!dev && !isServer) {
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: ['log', 'info', 'warn', 'debug'], // Xóa console nhưng giữ lại console.error
              drop_debugger: true,
            },
          },
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig;
