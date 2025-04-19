const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");
const { withAxiom } = require("next-axiom");

const REDIRECT_SEGMENTS = [
  "pricing",
  "blog",
  "help",
  "changelog",
  "tools",
  "_static",
];

/** @type {import('next').NextConfig} */
module.exports = withAxiom({
  reactStrictMode: false,
  transpilePackages: [
    "shiki",
    "@dub/prisma",
    "@dub/email",
    "@boxyhq/saml-jackson",
  ],
  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      esmExternals: "loose",
    },
  }),
  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
      config.plugins.push(
        // mute errors for unused typeorm deps
        new webpack.IgnorePlugin({
          resourceRegExp:
            /(^@google-cloud\/spanner|^@mongodb-js\/zstd|^aws-crt|^aws4$|^pg-native$|^mongodb-client-encryption$|^@sap\/hana-client$|^@sap\/hana-client\/extension\/Stream$|^snappy$|^react-native-sqlite-storage$|^bson-ext$|^cardinal$|^kerberos$|^hdb-pool$|^sql.js$|^sqlite3$|^better-sqlite3$|^ioredis$|^typeorm-aurora-data-api-driver$|^pg-query-stream$|^oracledb$|^mysql$|^snappy\/package\.json$|^cloudflare:sockets$)/,
        }),
      );

      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
  images: {
    remotePatterns: [
      {
        hostname: "assets.dub.co", // for Dub's static assets
      },
      {
        hostname: "dubassets.com", // for Dub's user generated images
      },
      {
        hostname: "dev.dubassets.com", // dev bucket
      },
      {
        hostname: "www.google.com",
      },
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "faisalman.github.io",
      },
      {
        hostname: "api.dicebear.com",
      },
      {
        hostname: "pbs.twimg.com",
      },
      {
        hostname: "lh3.googleusercontent.com",
      },
      {
        hostname: "avatars.githubusercontent.com",
      },
      {
        hostname: "media.cleanshot.cloud", // only for staging purposes
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer-when-downgrade",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "app.refl.ist",
          },
        ],
        destination: "https://app.thereflist.com",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "app.refl.ist",
          },
        ],
        destination: "https://app.thereflist.com/:path*",
        permanent: true,
        statusCode: 301,
      },
      ...REDIRECT_SEGMENTS.map(
        (segment) => (
          {
            source: `/${segment}`,
            has: [
              {
                type: "host",
                value: "refl.ist",
              },
            ],
            destination: `https://thereflist.com/${segment}`,
            permanent: true,
            statusCode: 301,
          },
          {
            source: `/${segment}/:path*`,
            has: [
              {
                type: "host",
                value: "refl.ist",
              },
            ],
            destination: `https://thereflist.com/${segment}/:path*`,
            permanent: true,
            statusCode: 301,
          }
        ),
      ),
      {
        source: "/metatags",
        has: [
          {
            type: "host",
            value: "refl.ist",
          },
        ],
        destination: "https://thereflist.com/tools/metatags",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/metatags",
        has: [
          {
            type: "host",
            value: "refl.ist",
          },
        ],
        destination: "/tools/metatags",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "staging.refl.ist",
          },
        ],
        destination: "https://thereflist.com",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "preview.refl.ist",
          },
        ],
        destination: "https://preview.thereflist.com",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "admin.refl.ist",
          },
        ],
        destination: "https://admin.thereflist.com",
        permanent: true,
        statusCode: 301,
      },
    ];
  },
  async rewrites() {
    return [
      // for reflist proxy
      {
        source: "/_proxy/thereflist/track/click",
        destination: "https://api.thereflist.com/track/click",
      },
      // for posthog proxy
      {
        source: "/_proxy/posthog/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/_proxy/posthog/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      // for plausible proxy
      {
        source: "/_proxy/plausible/script.js",
        destination: "https://plausible.io/js/script.js",
      },
      {
        source: "/_proxy/plausible/event",
        destination: "https://plausible.io/api/event",
      },
    ];
  },
});
