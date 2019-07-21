import { __ } from 'embark-i18n';
import { dappPath, ipcPath } from 'embark-utils';
import * as fs from 'fs-extra';
const async = require('async');
const path = require('path');
const os = require('os');
const semver = require('semver');
const {exec, spawn} = require('child_process');

const NAME = "lightchain";

const NOT_IMPLEMENTED_ERROR = __("is not implemented in or not applicable to a lightchain");

const DEFAULTS = {
  BIN: "lightchain",
  VERSIONS_SUPPORTED: ">=1.3.0",
  NETWORK_TYPE: "standalone",
  RPC_API: ['eth', 'web3', 'net', 'debug', 'personal'],
  WS_API: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal'],
  DEV_WS_API: ['eth', 'web3', 'net', 'debug', 'pubsub', 'personal']
};

const CLI_COMMANDS = {
  INIT: "init",
  RUN: "run"
};

const CLI_FEATURE_SUPPORT = {
  LIST_ACCOUNTS: false,
  CREATE_ACCOUNTS: false,
  GENESIS_FILE: false
}

const safePush = function(set, value) {
  if (set.indexOf(value) === -1) {
    set.push(value);
  }
};

class LightchainClient {

  static get DEFAULTS() {
    return DEFAULTS;
  }

  get CLI_FEATURE_SUPPORT() {
    return CLI_FEATURE_SUPPORT;
  }

  constructor(options) {
    this.config = options && options.hasOwnProperty('config') ? options.config : {};
    this.env = options && options.hasOwnProperty('env') ? options.env : 'development';
    this.isDev = options && options.hasOwnProperty('isDev') ? options.isDev : (this.env === 'development');
    this.name = this.NAME;
    this.prettyName = "Lightchain (https://github.com/lightstreams-network/lightchain)";
    this.bin = this.config.ethereumClientBin || DEFAULTS.BIN;
    this.versSupported = DEFAULTS.VERSIONS_SUPPORTED;
  }

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

  getMiner() {
    console.warn(__("Miner requested, but Parity does not embed a miner! Use Geth or install ethminer (https://github.com/ethereum-mining/ethminer)").yellow);
    return;
  }

  getBinaryPath() {
    return this.bin;
  }

  determineVersionCommand() {
    return this.bin + " version";
  }

  parseVersion(rawVersionOutput) {
    let parsed = "0.0.0";
    const match = rawVersionOutput.match(/Version: ([0-9]\.[0-9]\.[0-9]).*?/);
    if (match) {
      parsed = match[1].trim();
    }
    return parsed;
  }

  isSupportedVersion(parsedVersion) {
    let test;
    try {
      let v = semver(parsedVersion);
      v = `${v.major}.${v.minor}.${v.patch}`;
      test = semver.Range(this.versSupported).test(semver(v));
      if (typeof test !== 'boolean') {
        test = undefined;
      }
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return test;
    }
  }

  determineNetworkType() {
    if (this.isDev) {
      return "--standalone";
    }
    switch (this.config.networkType) {
      case "rinkeby":
      case "ropsten":
      case "kovan":
        console.warn(__('Lightchain does not support the Rinkeby/Ropsten/Kovan testnets. Please switch to geth to use these networks. Using the lightchain Sirius network instead.'));
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
          this.config.networkType = DEFAULTS.NETWORK_TYPE;
        break;
    }
    return `--${this.config.networkType}`;
  }

  // newAccountCommand() {
  //   console.warn(`'newAccountCommand' ${NOT_IMPLEMENTED_ERROR}`);
  // }

  // parseNewAccountCommandResultTo_(data = "") {
  //   console.warn(`'parseNewAccountCommandResultTo_' ${NOT_IMPLEMENTED_ERROR}`);
  // }

  // listAccountsCommand() {
  //   console.warn(`'listAccountsCommand' ${NOT_IMPLEMENTED_ERROR}`);
  // }

  // parseListAccountsCommandResultTo_(data = "") {
  //   console.warn(`'parseListAccountsCommandResultTo_' ${NOT_IMPLEMENTED_ERROR}`);
  // }

  // parseListAccountsCommandResultTo_List(data = "") {
  //   console.warn(`'parseListAccountsCommandResultTo_List' ${NOT_IMPLEMENTED_ERROR}`);
  // }

  // parseListAccountsCommandResultTo_Count(data = "") {
  //   console.warn(`'parseListAccountsCommandResultTo_Count' ${NOT_IMPLEMENTED_ERROR}`);
  // }

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
        console.warn(__('rpcCorsDomain set to *'));
        console.warn(__('make sure you know what you are doing'));
        console.warn('==================================');
      }
      cmd.push("--rpccorsdomain=" + config.rpcCorsDomain);
    } else {
      console.warn('==================================');
      console.warn(__('warning: cors is not set'));
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
          console.warn(__('wsOrigins set to *'));
          console.warn(__('make sure you know what you are doing'));
          console.warn('==================================');
        }
        cmd.push("--wsorigins=" + config.wsOrigins);
      } else {
        console.warn('==================================');
        console.warn(__('warning: wsOrigins is not set'));
        console.warn('==================================');
      }
    }
    return cmd;
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
    let self = this;
    let config = this.config;
    let rpc_api = this.config.rpcApi;
    let ws_api = this.config.wsApi;
    let args = [CLI_COMMANDS.RUN];
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
        if (config.vmdebug) {
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
        args.push('--rpcapi=' + rpc_api.join(','));
        callback(null, '--rpcapi=' + rpc_api.join(','));
      },
      function wsApi(callback) {
        args.push('--wsapi=' + ws_api.join(','));
        callback(null, '--wsapi=' + ws_api.join(','));
      },
    ], function(err) {
      if (err) {
        throw new Error(err.message);
      }
      return done(self.bin, args);
    });
  }
}

module.exports = LightchainClient;
