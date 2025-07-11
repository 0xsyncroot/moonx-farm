/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: 'export' to enable middleware support

  // Tắt X-Powered-By header để bảo mật
  poweredByHeader: false,

  // Trailing slash for consistent URLs
  trailingSlash: true,

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
    // Removed unoptimized: true since we're no longer using static export
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


  // Headers can now be configured since we're using Next.js server
  // Add custom headers here if needed

  webpack: (config, { dev, isServer }) => {
    // Fallback cho Node.js modules
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false
    };

    // Production optimizations
    if (!dev && !isServer) {
      // Bundle splitting optimization - chỉ cho client-side
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Framework chunk
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Lib chunk cho các thư viện lớn
          lib: {
            test(module) {
              return (
                module.size() > 160000 &&
                /node_modules[/\\]/.test(module.identifier())
              );
            },
            name: 'lib',
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
            chunks: 'all',
          },
          // Commons chunk cho code dùng chung
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
            chunks: 'all',
            reuseExistingChunk: true,
          },
        },
      };

      // Disable source maps in production to reduce bundle size
      config.devtool = false;
    }

    // Cache optimization cho faster builds
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };

    return config;
  },
};

module.exports = nextConfig;
