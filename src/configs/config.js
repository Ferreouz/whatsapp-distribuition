const dotenv = require("dotenv")

dotenv.config()

const config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: (process.env.REDIS_PORT) || 6379,
    db: (process.env.REDIS_DB) || 0,
  },
  webook:{
    dump:{
      url:(process.env.DUMP_URL) || "",
      key:(process.env.DUMP_KEY) || "",
    },
    close:{
      url:(process.env.FLOW_ID) || "",
      flowID:(process.env.CLOSE_FLOW_ID) || "",
    },
  }
}

module.exports = config