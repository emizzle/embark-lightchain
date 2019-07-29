# Embark-Lightchain Setup
Embark-Lightchain is a plugin for [Embark](https://github.com/embark-framework/embark) that allows DApp developers to use lightchain as their blockchain inside of Embark, instead of `geth` or `parity`.
> **PLEASE NOTE**
> This is completely alpha software and should not be used in a production environment.

## Requirements
1. Embark `^4.1.0-beta.5`

## Plugin config
The Embark-Lightchain plugin needs to be configured in your DApp's `embark.json` with four available properties:
```
"plugins": {
  "embark-lightchain": {}
},
```

## Blockchain config
All Embark blockchain configuration options are supported in this plugin. In addition, Tendermint port overrides can be configured in the `clientConfig` property of the blockchain config. These options will be passed to the CLI when Embark runs the lightchain process.
```
development: {
  // ...
  clientConfig: {
    tmt_p2p_port: 26656,
    tmt_rpc_port: 26657,
    tmt_proxy_port: 26658
  },
  // ...
}
```

To get you up and running using lightchain as your blockchain client, you can use the configuration below as a template for your DApp:
```
// This file contains only the basic configuration you need to run Embark's node
// For additional configurations, see: https://embark.status.im/docs/blockchain_configuration.html
module.exports = {
  // default applies to all environments
  default: {
    enabled: true,
    client: "lightchain" // Enabled using the `embark-lightchain` plugin
  },

  development: {
    clientConfig: {
      // tmt_p2p_port: 26656,
      // tmt_rpc_port: 26657,
      // tmt_proxy_port: 26658
    },
    accounts: [
      {
        nodeAccounts: true,
        numAccounts: "3",
        password: "config/testnet/password_lightchain"
      },
      {
        mnemonic: "YOUR_MNEMONIC",
        hdpath: "m/44'/60'/0'/0/",
        numAddresses: "1",
        balance: "100 ether"
      }
    ]
  },

  externalnode: {
    endpoint: "wss://node.sirius.lightstreams.io/ws", // Endpoint of an node to connect to. Can be on localhost or on the internet
    accounts: [
      {
        mnemonic: "YOUR_MNEMONIC",
        hdpath: "m/44'/60'/0'/0/",
        numAddresses: "1"
      }
    ]
  },

  testnet: {
    networkType: "sirius", // Can be: standalone, sirius/testnet/ropsten/rinkeby/kovan, livenet/mainnet
    networkId: 162, // should match the network id given by the network type. ie, if we are on Sirius, the networkId is 162.
    accounts: [
      {
        mnemonic: "YOUR_MNEMONIC",
        hdpath: "m/44'/60'/0'/0/",
        numAddresses: "1"
      }
    ]
  },

  livenet: {
    networkType: "mainnet",
    networkId: 163
  }

  // you can name an environment with specific settings and then specify with
  // "embark run custom_name" or "embark blockchain custom_name"
  //custom_name: {
  //}
};
```

## Example DApp
The [`embark-blockchain-plugin-demo`](https://github.com/emizzle/embark-blockchain-plugin-demo) is an example DApp using this plugin.

#### Please report any other issues you find, thank you!
