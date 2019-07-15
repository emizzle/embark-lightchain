import pify from "pify";
export default class EmbarkLightchain {
  constructor(embark) {

    this.embark = embark;
    this.events = embark.events;
    this.pluginConfig = embark.pluginConfig;

    // gets hydrated blockchain config from embark, use it to init
    this.events.once("config:load:blockchain", (blockchainConfig) => {
      this.events.once("blockchain:ready", async () => {
        // if we're in dev mode, unlock our default development deployment account
        if (blockchainConfig.isDev) {
          this.events.request("blockchain:get", async (web3) => {
            await this.unlockDevAccount(web3);
            this.embark.logger.info("Unlocked lightchain dev account");
          });
        }
        this.embark.logger.info("Lightchain node is ready!");
      })
      this.registerBlockchain();
    });
  }

  async unlockDevAccount(web3) {
    return web3.eth.personal.unlockAccount("0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e", "WelcomeToSirius");
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}