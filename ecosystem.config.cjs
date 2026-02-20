module.exports = {
  apps: [
    {
      name: "cc-mcp",
      script: "dist/index.js",
      cwd: "/root/cineconcerts-mcp",
      env: {
        NODE_ENV: "production",
        PORT: 8421,
        HOST: "127.0.0.1",
      },
    },
  ],
};
