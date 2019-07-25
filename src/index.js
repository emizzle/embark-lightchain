import fs from "fs";

const DEV_ACCOUNT = {
  address: "0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e",
  password: "WelcomeToSirius"
};
const TEST_ACCOUNT = {
  address: "0xd119b8b038d3a67d34ca1d46e1898881626a082b"
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
    });
    this.embark.registerActionForEvent("blockchain:provider:ready", (cb) => {
      this.onProviderReady((err) => {
        if (err) {
          return this.embark.logger.error(err.message);
        }
        this.embark.logger.info("Lightchain node is ready!");
        cb();
      });
    });
  }

  onProviderReady(callback) {
    this.events.request("blockchain:get", async (web3) => {
      this.web3 = web3;
      try {
        const configuredNodeAccounts = this.blockchainConfig.accounts && this.blockchainConfig.accounts.find(account => account.nodeAccounts);
        let password = "";
        if (configuredNodeAccounts) {
          if (configuredNodeAccounts.password) {
            try {
              password = fs.readFileSync(configuredNodeAccounts.password).toString();
            } catch (err) {
              throw new Error(`Error reading password file '${configuredNodeAccounts.password}': ${err.message || err}`)
            }
          }
          await this.ensureNodeAccounts(configuredNodeAccounts, password);
          await this.unlockNodeAccounts(password);
          callback();
        }
      } catch (err) {
        callback(err);
      }
    });
  }

  get nodeAccounts() {
    return (async () => {
      const accounts = await this.web3.eth.personal.getAccounts();
      return accounts.filter((account) =>
        // remove the test account that is meant for internal use only
        account.toLowerCase() !== TEST_ACCOUNT.address.toLowerCase()
      );
    })();
  }

  async ensureNodeAccounts(configuredNodeAccounts, password) {
    if (!configuredNodeAccounts) return;

    const ensureNumNodeAccounts = parseInt(configuredNodeAccounts.numAccounts || 1, 10);

    // create node accounts if needed
    let accountsCreated = 0;
    const currNodeAccounts = await this.nodeAccounts;
    if (currNodeAccounts.length < ensureNumNodeAccounts) {
      if (password === "") {
        throw new Error("Cannot create a node account with a blank password. Please specify a password in the blockchain config.");
      }
      try {
        while ((currNodeAccounts.length + accountsCreated++) < ensureNumNodeAccounts) {
          const address = await this.web3.eth.personal.newAccount(password);
          this.embark.logger.info(`Created node account '${address}'`);
        }
      } catch (err) {
        throw new Error(`Error creating new node account: ${err.message || err}`);
      }
    }
  }

  async unlockNodeAccounts(password) {
    const currNodeAccounts = await this.nodeAccounts;

    // unlock node account - warn if no password specified
    if (password === "") {
      this.embark.logger.warn("A password was not specified for the node account. A blank password will be used to unlock the account.");
    }

    const errors = [];
    for (let address of currNodeAccounts) {
      try {
        let unlockPassword = password;
        let isDeveloperAcct = false;
        if (this.isDev && address.toLowerCase() === DEV_ACCOUNT.address.toLowerCase()) {
          unlockPassword = DEV_ACCOUNT.password;
          isDeveloperAcct = true;
        }
        const unlockResult = await this.web3.eth.personal.unlockAccount(address, unlockPassword, 0);
        if (unlockResult) {
          this.embark.logger.info(`Successfully unlocked ${isDeveloperAcct ? "developer" : ""} node account '${address}'`);
        } else {
          errors.push(new Error(`Account unlock failed for '${address}'`));
        }
      }
      catch (err) {
        errors.push(new Error(`Could not unlock node account '${address}': ${err.message || err}`));
      }
    }
    if (errors.length) {
      throw new Error(`Error unlocking node accounts: ${errors.join("\n")}`);
    }
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}