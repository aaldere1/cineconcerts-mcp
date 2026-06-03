module.exports = {
  apps: [
    {
      name: "cc-mcp",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 8421,
        HOST: "127.0.0.1",
      },
    },
  ],
};
