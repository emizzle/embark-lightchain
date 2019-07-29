import {BaseBlockchainPlugin} from 'embark-blockchain-process';
import fs from "fs";

/**
 * Development node account created by lightchain with 300M photons
 */
const DEV_ACCOUNT = {
  address: "0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e",
  password: "WelcomeToSirius"
};
/**
 * Node account created by lightchain when running on the --sirius testnet.
 * This account is used internally for testing.
 */
const TEST_ACCOUNT = {
  address: "0xd119b8b038d3a67d34ca1d46e1898881626a082b"
};

/**
 * @typedef {Object} BlockchainClientOptions Options to pass to the base class and to the blockchain client.
 * @property {Object} defaults default config values to pass to the client. These can be overridden by values in the config.
 * @property {string} versSupported Mimimum client version supported, ie ">=1.3.0"
 * @property {string} versionRegex Regex used to parse the version from the version command (returned from determineVersionCommand())
 * @property {string} name Name of blockchain client - used in the blockchain config "client" property
 * @property {string} prettyName Pretty name of blockchain client
 * @property {string} clientPath Absolute path to the blockchain client class
 */
const BLOCKCHAIN_CLIENT_OPTIONS = {
  defaults: {
    bin: "lightchain",
    networkType: "standalone",
    rpcApi: ['eth', 'web3', 'net', 'debug', 'personal'],
    wsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal'],
    devWsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal']
  },
  versSupported: ">=1.3.0",
  versionRegex: "Version: ([0-9]\.[0-9]\.[0-9]).*?",
  name: "lightchain",
  prettyName: "Lightchain (https://github.com/lightstreams-network/lightchain)",
  clientPath: require.resolve("./client")
};

export default class EmbarkLightchain extends BaseBlockchainPlugin {
  /**
   * Creates an Embark Lightchain blockchain client plugin
   * @param {*} embark 
   */
  constructor(embark) {
    /**
     * Pass in the Embark object and any {@link BlockchainClientOptions} to the base class constructor
     */
    super(embark, BLOCKCHAIN_CLIENT_OPTIONS);
    this.logger = embark.logger;
    this.isDev = embark.config.env === "development";
  }

  /**
   * Gets accounts on the node
   */
  get nodeAccounts() {
    return (async () => {
      if (!this.web3) {
        return [];
      }
      const accounts = await this.web3.eth.personal.getAccounts();
      return accounts.filter((account) =>
        // remove the test account that is meant for internal use only
        account.toLowerCase() !== TEST_ACCOUNT.address.toLowerCase()
      );
    })();
  }

  /**
   * Creates and unlocks node accounts as configured by the DApp's blockchain config.
   * Overridden from the base class. This method is executed automatically by the base class when:
   * 1.) The DApp's blockchain config client is set to this blockchain client, ie "lightchain"
   * 2.) After "blockchain:provider:ready" is fired
   * 3.) Before "blockchain:ready" is fired
   */
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

  /**
   * Ensure that the requested node accounts configured in the DApp's blockchain config exist on the node
   * @param {*} configuredNodeAccounts Configuration of node accounts from the blockchain config from the current runtime environment
   * @param {*} password Password used to create node accounts (if needed) and unlock the node accounts.
   */
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

  /**
   * Unlocks all node accounts using the given password
   * @param {*} password Password used to unlock the node accounts
   */
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