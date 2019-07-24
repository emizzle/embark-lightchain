import * as fs from 'fs-extra';
import { BaseBlockchainClient } from 'embark-blockchain-process';
const async = require('async');
const path = require('path');
const {exec, spawn} = require('child_process');

const CLI_COMMANDS = {
  INIT: "init",
  RUN: "run"
};

class LightchainClient extends BaseBlockchainClient {

  constructor(options) {
    options.defaults = {
      bin: "lightchain",
      networkType: "standalone",
      rpcApi: ['eth', 'web3', 'net', 'debug', 'personal'],
      wsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal'],
      devWsApi: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal']
    };
    options.versSupported = ">=1.3.0";
    options.name = "lightchain";
    options.prettyName = "Lightchain (https://github.com/lightstreams-network/lightchain)";
    super(options);
  }

  //#region Overriden Methods
  isReady(data) {
    if (data.indexOf('HTTP endpoint opened') > -1) {
      this.httpReady = true;
    }
    if (data.indexOf('WebSocket endpoint opened') > -1) {
      this.wsReady = true;
    }
    return this.httpReady && this.wsReady;
  }

  /**
   * Check if the client needs some sort of 'keep alive' transactions to avoid freezing by inactivity
   * @returns {boolean} if keep alive is needed
   */
  needKeepAlive() {
    return false;
  }

  getMiner() {
    console.warn("Miner requested, but lightchain does not need a miner! Please remove the 'mineWhenNeeded' setting from the blockchain config.").yellow;
    return;
  }

  determineVersionCommand() {
    return this.bin + " version";
  }

  initChain(callback) {
    let args = [CLI_COMMANDS.INIT];
    args = args.concat(this.determineNetworkType());
    args = args.concat(this.commonOptions());
    exec(`${this.bin} ${args.join(" ")}`, {}, (err, stdout, _stderr) => {
      if (err || stdout) {
        if(err && err.message && err.message.includes(`unable to initialize lightchain node. ${this.config.datadir} already exists`)) {
          return callback();
        }
        return callback((err && err.message) || stdout);
      }
      callback();
    });
  }

  mainCommand(_address, done) {
    let { rpcApi, wsApi } = this.config;
    let args = [CLI_COMMANDS.RUN];
    const self = this;
    async.series([
      function commonOptions(callback) {
        let cmd = self.commonOptions();
        args = args.concat(cmd);
        callback(null, cmd);
      },
      function messagePortOptions(callback) {
        let cmd = self.determineMessagingPortOptions(self.config);
        args = args.concat(cmd);
        callback(null, cmd);
      },
      function rpcOptions(callback) {
        let cmd = self.determineRpcOptions(self.config);
        args = args.concat(cmd);
        callback(null, cmd);
      },
      function wsOptions(callback) {
        let cmd = self.determineWsOptions(self.config);
        args = args.concat(cmd);
        callback(null, cmd);
      },
      function vmDebug(callback) {
        if (self.config.vmdebug) {
          args.push("--trace");
          return callback(null, "--trace");
        }
        callback(null, "");
      },
      // TODO: uncomment when lightchain implements Whisper support
      // function whisper(callback) {
      //   if (config.whisper) {
      //     rpc_api.push('shh');
      //     if (ws_api.indexOf('shh') === -1) {
      //       ws_api.push('shh');
      //     }
      //     args.push("--shh");
      //     return callback(null, "--shh ");
      //   }
      //   callback("");
      // },
      function rpcApi(callback) {
        args.push('--rpcapi=' + self.config.rpcApi.join(','));
        callback(null, '--rpcapi=' + self.config.rpcApi.join(','));
      },
      function wsApi(callback) {
        args.push('--wsapi=' + self.config.wsApi.join(','));
        callback(null, '--wsapi=' + self.config.wsApi.join(','));
      },
    ], function(err) {
      if (err) {
        throw new Error(err.message);
      }
      return done(self.bin, args);
    });
  }

  //#endregion

  //#region Custom methods

  commonOptions() {
    let config = this.config;
    let cmd = [];

    if (config.datadir) {
      cmd.push(`--datadir=${config.datadir}`);
    }

    if (Number.isInteger(config.verbosity) && config.verbosity >= 0 && config.verbosity <= 5) {
      switch (config.verbosity) {
        case 0:
          cmd.push("--lvl=crit");
          break;
        case 1:
          cmd.push("--lvl=error");
          break;
        case 2:
          cmd.push("--lvl=warn");
          break;
        case 3:
          cmd.push("--lvl=info");
          break;
        case 4:
          cmd.push("--lvl=debug");
          break;
        case 5:
          cmd.push("--lvl=trace");
          break;
        default:
          cmd.push("--lvl=info");
          break;
      }
    }

    return cmd;
  }

  determineNetworkType() {
    if (this.isDev) {
      return "--standalone";
    }
    switch (this.config.networkType) {
      case "rinkeby":
      case "ropsten":
      case "kovan":
        console.warn('Lightchain does not support the Rinkeby/Ropsten/Kovan testnets. Please switch to geth to use these networks. Using the lightchain Sirius network instead.');
        this.config.networkType = 'sirius';
        this.config.networkId = 162;
        break;
      case "testnet":
      case "sirius":
          this.config.networkType = 'sirius';
          this.config.networkId = 162;
        break;
      case "livenet":
      case "mainnet":
          this.config.networkType = 'mainnet';
        break;
      default:
          this.config.networkType = this.defaults.networkType;
        break;
    }
    return `--${this.config.networkType}`;
  }

  determineMessagingPortOptions(config) {
    let cmd = [];
    if (!config.clientConfig) {
      return cmd;
    }
    const {tmt_p2p_port, tmt_proxy_port, tmt_rpc_port} = config.clientConfig;
    if (tmt_p2p_port) cmd.push("--tmt_p2p_port=" + tmt_p2p_port);
    if (tmt_proxy_port) cmd.push("--tmt_proxy_port=" + tmt_proxy_port);
    if (tmt_rpc_port) cmd.push("--tmt_rpc_port=" + tmt_rpc_port);
    return cmd;
  }

  determineRpcOptions(config) {
    let cmd = [];
    cmd.push("--rpc");
    cmd.push("--rpcport=" + config.rpcPort);
    cmd.push("--rpcaddr=" + config.rpcHost);
    if (config.rpcCorsDomain) {
      if (config.rpcCorsDomain === '*') {
        console.warn('==================================');
        console.warn('rpcCorsDomain set to *');
        console.warn('make sure you know what you are doing');
        console.warn('==================================');
      }
      cmd.push("--rpccorsdomain=" + config.rpcCorsDomain);
    } else {
      console.warn('==================================');
      console.warn('warning: cors is not set');
      console.warn('==================================');
    }
    return cmd;
  }

  determineWsOptions(config) {
    let cmd = [];
    if (config.wsRPC) {
      cmd.push("--ws");
      cmd.push("--wsport=" + config.wsPort);
      cmd.push("--wsaddr=" + config.wsHost);
      if (config.wsOrigins) {
        if (config.wsOrigins === '*') {
          console.warn('==================================');
          console.warn('wsOrigins set to *');
          console.warn('make sure you know what you are doing');
          console.warn('==================================');
        }
        cmd.push("--wsorigins=" + config.wsOrigins);
      } else {
        console.warn('==================================');
        console.warn('warning: wsOrigins is not set');
        console.warn('==================================');
      }
    }
    return cmd;
  }

  //#endregion
}

module.exports = LightchainClient;
