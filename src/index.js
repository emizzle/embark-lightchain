import pify from "pify";
import {ipcPath} from "embark-utils";
export default class EmbarkLightchain {
  constructor(embark) {

    this.embark = embark;
    this.events = embark.events;
    this.pluginConfig = embark.pluginConfig;

    // gets hydrated blockchain config from embark, use it to init
    this.events.once("config:load:blockchain", (blockchainConfig) => {
      this.events.once("blockchain:ready", async () => {
        // TODO: replace with --ipcpath option once it's supported in lightchain
        await this.createSymlink(blockchainConfig);
        // if we're in dev mode, unlock our default development deployment account
        if (blockchainConfig.isDev) {
          this.events.request("blockchain:get", async (web3) => {
            await pify(this.embark.registerActionForEvent("deploy:beforeAll"))(this.unlockDevAccount.bind(this, web3));
          });
        }
        this.embark.logger.info("Lightchain node is ready!");
      })
      this.registerBlockchain();
    });
  }

  async unlockDevAccount(web3, cb) {
    await web3.eth.personal.unlockAccount("0xc916cfe5c83dd4fc3c3b0bf2ec2d4e401782875e", "WelcomeToSirius");
    cb();
  }
  // TODO: This is a temporary solution to lightchain not supporting --ipcpath flag.
  // It should be implemented as a feature at some point in the future. See
  // https://github.com/lightstreams-network/lightchain/issues/142 for more info.
  async createSymlink(blockchainConfig) {
    try {
      const symlinkDest = await pify(this.events.request.bind(this.events))('code-generator:dapp:symlink:generate', blockchainConfig.datadir, ipcPath('geth.ipc', true), 'geth.ipc');
    } catch (err) {
      this.embark.logger.error(`Error creating a symlink to geth.ipc: ${err.message || err}`);
    }
  }

  registerBlockchain() {
    this.embark.registerBlockchain("lightchain", require.resolve("./client"));
  }
}