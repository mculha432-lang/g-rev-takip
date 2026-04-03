module.exports = {
  apps: [{
    name: "elbistan-mem-egts",
    script: "./server.js",
    instances: "max",   // CPU core sayısına göre otomatik instance başlat
    exec_mode: "cluster", // Cluster modunda (yük dengeleme) çalıştır
    watch: false,       // Prod ortamında watch kapalı olmalıdır
    max_memory_restart: "1G", // 1GB RAM aşımında otomatik yeniden başlat (Self-healing)
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    time: true // Loglara zaman damgası ekle
  }]
};
