const config  = require( "./config")


  /**WEBHOOK to dump data at the end of chat */
  export const dump = {
    url:config.webook.dump.url,
    key:config.webook.dump.key
  };
  /**WEBHOOK when closing the chat, opens BotConversa one  */
  export const close={
    // url:config.webook.close.url,
    key:config.webook.close.key,
    flowID:config.webook.close.flowID,
  };

// module.exports = webhook