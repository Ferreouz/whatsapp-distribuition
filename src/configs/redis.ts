const { Redis } = require("ioredis")

import * as config from "./config"

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db,
})
// module.exports = redis