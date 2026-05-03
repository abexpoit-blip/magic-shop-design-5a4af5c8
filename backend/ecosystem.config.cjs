module.exports = {
  apps: [{
    name: "cruzercc-api",
    script: "dist/server.js",
    cwd: "/var/www/cruzercc/backend",
    env: {
      NODE_ENV: "production",
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: "256M",
    error_file: "/var/log/cruzercc/error.log",
    out_file: "/var/log/cruzercc/out.log",
  }],
};
