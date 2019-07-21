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
    this.isDev = embark.config.env === "development";

    this.registerBlockchain();

    // gets hydrated blockchain config from embark, use it to init
    this.events.once("config:load:blockchain", (blockchainConfig) => {
      this.blockchainConfig = blockchainConfig;

      this.embark.logger.info("======> loaded blockchain config");
    });
    this.events.once("blockchain:ready", () => {
      this.onBlockchainReady();
      this.embark.logger.info("Lightchain node is ready!");
    });
  }

  onBlockchainReady() {
    this.events.request("blockchain:get", async (web3) => {
      // if we're in dev mode, unlock our developer account
      if (this.isDev) {
        const {address, password} = DEV_ACCOUNT;
        await web3.eth.personal.unlockAccount(address, password);
        this.embark.logger.info(`Unlocked lightchain dev account '${address}'`);
      }
      try {
        await this.createAccounts(web3);
      } catch (err) {
        this.embark.logger.error(err.message);
      }
    });
  }

  async createAccounts(web3) {
    const nodeAccount = this.blockchainConfig.accounts && this.blockchainConfig.accounts.find(account => account.nodeAccounts);
    if (!nodeAccount) return;

    if (this.isDev) {
      this.embark.logger.warn("'nodeAccounts' is specified in the development blockchain config, but lightchain includes it's own node account for development, so this configuration option will be ignored.");
    }

    if (nodeAccount.numAccounts) {
      this.embark.logger.warn("'numAccounts' was specified in the blockchain config but it will be ignored. This plugin only supports one node account.");
    }


    let password = "";
    if (nodeAccount.password) {
      try {
        password = fs.readFileSync(nodeAccount.password).toString();
      } catch (err) {
        throw new Error(`Error reading password file '${nodeAccount.password}': ${err.message || err}`)
      }
    }

    // create node accounts if needed
    const currNodeAccounts = await web3.eth.personal.getAccounts();
    let address = "";
    if (!currNodeAccounts.length) {
      if (password === "") {
        throw new Error("Cannot create a node account with a blank password. Please specify a password in the blockchain config.");
      }
      try {
        address = await web3.eth.personal.newAccount(password);
        this.embark.logger.info(`Created node account '${address}'`);
      } catch (err) {
        throw new Error(`Error creating a new node account: ${err.message || err}`);
      }
    } else {
      address = currNodeAccounts[0];
    }

    // unlock node account - warn if no password specified
    if (password === "") {
      this.embark.logger.warn("A password was not specified for the node account. A blank password will be used to unlock the account.");
    }
    try {
      const unlockResult = await web3.eth.personal.unlockAccount(address, password);
      if (unlockResult) {
        this.embark.logger.info(`Successfully unlocked node account '${address}'`);
      } else {
        throw new Error(`Could not unlock node account '${address}'`);
      }
    }
    catch (err) {
      throw new Error(`Could not unlock node account '${address}': ${err.message || err}`);
    }


    // nodeAccounts is not supported. For more information, please read https://notes.status.im/4Zvs5EcUR_-Eu-BOwnCNEw
    //this.embark.logger.warn("Specifying blockchain config node accounts is not supported using a blockchain plugin yet. You can still specify wallet accounts in the config or create your own node accounts manually.");
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}