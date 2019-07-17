import pify from "pify";
import fs from "fs";

const DEV_ACCOUNT = {
  address: "0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e", 
  password: "WelcomeToSirius"
};

export default class EmbarkLightchain {
  constructor(embark) {

    this.embark = embark;
    this.events = embark.events;
    this.pluginConfig = embark.pluginConfig;

    // gets hydrated blockchain config from embark, use it to init
    this.events.once("config:load:blockchain", (blockchainConfig) => {
      this.blockchainConfig = blockchainConfig;
    });
    this.events.once("blockchain:ready", async () => {
      await this.onBlockchainReady();
      this.embark.logger.info("Lightchain node is ready!");
    });
    this.registerBlockchain();
  }
  
  async onBlockchainReady() {
    this.events.request("blockchain:get", async (web3) => {
      // if we're in dev mode, unlock our developer account
      if (this.blockchainConfig.isDev) {
        const { address, password } = DEV_ACCOUNT;
        await web3.eth.personal.unlockAccount(address, password);
        this.embark.logger.info("Unlocked lightchain dev account");
      }
      this.createAccounts();
    });
  }

  createAccounts() {
    const nodeAccounts = this.blockchainConfig.accounts && this.blockchainConfig.accounts.find(account => account.nodeAccounts);
    if(!nodeAccounts) return;

    // nodeAccounts is not supported. For more information, please read https://notes.status.im/4Zvs5EcUR_-Eu-BOwnCNEw
    this.embark.logger.warn("Specifying blockchain config node accounts is not supported using a blockchain plugin yet. You can still specify wallet accounts in the config.");
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}