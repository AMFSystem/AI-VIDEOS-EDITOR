export const corsConfig = {
  origin: (origin, callback) => {
    // Support all origins: localhost, 127.0.0.1, electron app, file://, opaque null origin, and custom schemes
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Range",
    "Accept",
    "Cache-Control",
    "X-Requested-With",
    "Origin",
    "User-Agent",
    "Sec-Fetch-Mode",
    "Sec-Fetch-Site",
    "Sec-Fetch-Dest",
    "Access-Control-Request-Private-Network"
  ],
  exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
  credentials: true,
};
