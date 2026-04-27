module.exports = {
  apps: [
    {
      name: "cruzercc-api",
      script: "dist/server.js",
      cwd: "/var/www/cruzercc/backend",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "400M",
      out_file: "/var/log/cruzercc/api.out.log",
      error_file: "/var/log/cruzercc/api.err.log",
      time: true
    }
  ]
};
