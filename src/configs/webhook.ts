const config = require("./config")


/**WEBHOOK to dump data at the end of chat */
export const dump = {
  url: config.webhook.dump.url,
  key: config.webhook.dump.key
};
export const error = {
  url: config.webhook.error.url,
  key: config.webhook.dump.key
};
/**WEBHOOK when closing the chat, opens BotConversa one  */
export const close = {
  // url:config.webook.close.url,
  key: config.webhook.close.key,
  flowID: config.webhook.close.flowID,
};

// module.exports = webhook