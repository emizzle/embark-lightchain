import { BaseBlockchainPlugin } from 'embark-blockchain-process';
import fs from "fs";

const DEV_ACCOUNT = {
  address: "0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e",
  password: "WelcomeToSirius"
};
const TEST_ACCOUNT = {
  address: "0xd119b8b038d3a67d34ca1d46e1898881626a082b"
};

const BLOCKCHAIN_CLIENT_OPTIONS = {
  defaults: {
    bin: "lightchain",
    networkType: "standalone",
    rpcApi: ['eth', 'web3', 'net', 'debug', 'personal'],
    wsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal'],
    devWsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal']
  },
  versSupported: ">=1.3.0",
  name: "lightchain",
  prettyName: "Lightchain (https://github.com/lightstreams-network/lightchain)",
  clientPath: require.resolve("./client")
};

export default class EmbarkLightchain extends BaseBlockchainPlugin {
  constructor(embark) {
    super(embark, BLOCKCHAIN_CLIENT_OPTIONS);
    this.logger = embark.logger;
    this.isDev = embark.config.env === "development";
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

  async createAndUnlockAccounts() {
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
      }
    } catch (err) {
      throw new Error(`Error creating and unlocking accounts: ${err.message || err}`);
    }
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
          this.logger.info(`Created node account '${address}'`);
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
      this.logger.warn("A password was not specified for the node account. A blank password will be used to unlock the account.");
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
          this.logger.info(`Successfully unlocked ${isDeveloperAcct ? "developer" : ""} node account '${address}'`);
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
}