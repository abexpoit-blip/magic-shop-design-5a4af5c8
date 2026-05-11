// PM2 config for cruzercc-api.
// Hardening goals:
//  1. Always go through preflight.mjs so we refuse to start if PORT is occupied.
//  2. Single instance, fork mode — never two processes competing for one port.
//  3. Cap restarts so an EADDRINUSE conflict can't loop forever.
//  4. Explicit name + cwd so `pm2 restart cruzercc-api` is unambiguous.
module.exports = {
  apps: [
    {
      name: "cruzercc-api",
      script: "scripts/preflight.mjs",
      cwd: "/var/www/cruzercc/backend",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      // Stop infinite restart loops when the port is taken or build is broken.
      max_restarts: 5,
      min_uptime: "15s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/cruzercc/error.log",
      out_file: "/var/log/cruzercc/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
