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
      // if we're in dev mode, unlock our default development deployment account
      if (this.blockchainConfig.isDev) {
        const { address, password } = DEV_ACCOUNT;
        await web3.eth.personal.unlockAccount(address, password);
        this.embark.logger.info("Unlocked lightchain dev account");
      }
      await this.createAccounts(web3);
    });
  }

  async createAccounts(web3) {
    const nodeAccounts = this.blockchainConfig.accounts.find(account => account.nodeAccounts);
    if(!nodeAccounts) return;

    const { numAddresses: strNumAddresses = "1", password: passwordFile } = nodeAccounts;
    const numAddresses = parseInt(strNumAddresses, 10);
    
    if(numAddresses) {
      if(!passwordFile) {
        return this.embark.logger.error("Missing password in blockchain config. Please add a path to a password file to the 'accounts.password' property in the blockchain config.");
      }
      const password = (await pify(fs.readFile)(passwordFile)).toString();
      try {
        // get num existing accounts on node
        let numCreatedAccts = (await web3.eth.getAccounts()).length;
        while (numAddresses > numCreatedAccts++) {
          const address = await web3.eth.personal.newAccount(password);
          await web3.eth.personal.unlockAccount(address, password);
          this.embark.logger.info(`Created and unlocked account '${address}'`);
        }
        this.embark.logger.info(`Accounts after creating/unlocking: ${JSON.stringify(await web3.eth.getAccounts())}`);
        this.embark.logger.info(`Accounts after creating/unlocking (personal): ${JSON.stringify(await web3.eth.personal.getAccounts())}`);
      } catch (err) {
        return this.embark.logger.error(`Error getting existing accounts and creating new accounts: ${(err && err.message) || err}`)
      }
    }
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}