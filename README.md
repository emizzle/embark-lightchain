# Embark-Lightchain Setup
Embark-Lightchain is a plugin for [Embark](https://github.com/embark-framework/embark) that does the following:
1. Provides Embark console commands for Plasma chain operations
2. Initialises EmbarkJS.Plasma in the console and makes these operations available in the DApp.
The plugin currently only supports OMG's Samrong network and (v0.2) of the OMG SDK. The root chain is a contract on Rinkeby and the Plasma chain runs on Samrong. Chains created for development will be created in the future.

> **PLEASE NOTE**
> This is completely alpha software and should not be used in a production environment.

## Requirements
1. Embark `^4.1.0-beta.2`

## Plugin config
The Embark-Plasma plugin needs to be configured in your DApp's `embark.json` with four available properties.
`WATCHER_URL`: The URL of the child chain watcher.
`CHILDCHAIN_URL`: The child chain endpoint.
`CHILDCHAIN_EXPLORER_URL`: Block explorer URL for the child chain.
`PLASMA_CONTRACT_ADDRESS`: Plasma contract address.
An example plugin configuration can be found below. Note the contract address is the address of the plasma contract on Rinkeby.
```
"plugins": {
  "embarkjs-connector-web3": {},
  "embark-omg": {
    "WATCHER_URL": "http://watcher.samrong.omg.network/",
    "CHILDCHAIN_URL": "http://samrong.omg.network/",
    "CHILDCHAIN_EXPLORER_URL": "http://quest.samrong.omg.network/",
    "PLASMA_CONTRACT_ADDRESS": "0x740ecec4c0ee99c285945de8b44e9f5bfb71eea7"
  }
},
```

## Current limitations and known issues
1. The console commands can only be run when Embark is run in the Rinkeby environment, ie `embark run rinkeby` and the `rinkeby` enviroinment is correctly configured as described below. 
2. This plugin can also be run in development configuration `embark run`, however the console commands will not work correctly, as they will be interfacing with a contract address on the local blockchain and not rinkeby.

## Environment setup
These commands require that Embark is set in testnet environment, on Rinkeby, and that an account with funds on Rinkeby is added to the contract account configuration (ie via mnemonic). General information about configuring a testnet environment can be found in [Embark's documentation](https://embark.status.im/docs/contracts_deployment.html).

_The first account configured that is not the coinbase will be used as the main account in the child chain._

We recommend using a testnet configuration in `config/contracts.js` like:
```
module.exports = {
  //...
  rinkeby: {
    deployment: {
      host: "rinkeby.infura.io/v3/INFURA_API_KEY",
      port: false,
      type: "rpc",
      protocol: "https",
      accounts: [
        {
          mnemonic: "MNEMONIC_HERE",
          addressIndex: "0", // Optional. The index to start getting the address
          numAddresses: "2", // Optional. The number of addresses to get
          hdpath: "m/44'/60'/0'/0/" // Optional. HD derivation path
        }
      ]
    },
    contracts: {
      PlasmaCore: {
        address: "0x740ecec4c0ee99c285945de8b44e9f5bfb71eea7",
        abiDefinition: require("@omisego/omg-js-rootchain/src/contracts/RootChain.json").abi
      }
    },
    dappConnection: [
      "$WEB3",  // uses pre existing web3 object if available (e.g in Mist)
      "https://rinkeby.infura.io/v3/INFURA_API_KEY"
    ]
  },
  //...
}
```
The above configuration sets up an environment called `rinkeby`. To run Embark using the `rinkeby` environment, you would run:
```
embark run rinkeby
```
> NOTE: You can still run Embark in the development environment with this plugin, ie `embark run`, however the console commands will not work correctly. The DApp will still have access to `EmbarkJS.Plasma` and will still function correctly.

## Available console commands
Embark console commands can be executed in an embark console (by running `embark console rinkeby`) or in Cockpit's builtin console on the Dashboard (available after running `embark run rinkeby`). The available console commands are listed below.

### Init
Initialises the root and child chains and sets up web3. This is already done for us in the context of Embark, however we can re-initialise the plugin using the `--force` param if needed.
```
# plasma init [--force]
plasma init
```

### Status
Gets the status of the child chain.
```
# plasma status
plasma status

Example output:
{ byzantine_events:
  [ 
    { details: [Object], event: 'unchallenged_exit' },
    { details: [Object], event: 'unchallenged_exit' },
    { details: [Object], event: 'invalid_exit' },
    { details: [Object], event: 'invalid_exit' } 
  ],
  contract_addr: '0x740ecec4c0ee99c285945de8b44e9f5bfb71eea7',
  eth_syncing: false,
  in_flight_exits: [],
  last_mined_child_block_number: 247000,
  last_mined_child_block_timestamp: 1560740479,
  last_seen_eth_block_number: 4574127,
  last_seen_eth_block_timestamp: 1560741679,
  last_validated_child_block_number: 239000,
  last_validated_child_block_timestamp: 1560431021,
  services_synced_heights:
  [ 
    { height: 4553417, service: 'block_getter' },
    { height: 4574114, service: 'challenges_responds_processor' },
    { height: 4574114, service: 'competitor_processor' },
    { height: 4574116, service: 'convenience_deposit_processor' },
    { height: 4553417, service: 'convenience_exit_processor' },
    { height: 4574116, service: 'depositor' },
    { height: 4574114, service: 'exit_challenger' },
    { height: 4553417, service: 'exit_finalizer' },
    { height: 4574114, service: 'exit_processor' },
    { height: 4553417, service: 'ife_exit_finalizer' },
    { height: 4574114, service: 'in_flight_exit_processor' },
    { height: 4574114, service: 'piggyback_challenges_processor' },
    { height: 4574114, service: 'piggyback_processor' },
    { height: 4574126, service: 'root_chain_height' } 
  ] 
}
```

### Deposit
Deposits wei from the root chain (Rinkeby) to the child chain by sending funds to the Plasma contract on Rinkeby
```
# plasma deposit [amount]
plasma deposit 10000
```

### Transfer
Transfers wei from the main child chain account to any other account on Rinkeby.
```
# plasma transfer [to_address] [amount]
plasma transfer 0xcc9581513771666c47b5f664024B2f47d5C08bD3 100
```

### Exit
Exits all UTXO's from the child chain to the root chain for a particular address. Note that exits are subject to the minimum finalisation period (current 7 days). Please see the [`elixir-omg` documentation for more information](https://github.com/omisego/elixir-omg/blob/master/docs/morevp.md#morevp-exit-protocol-specification).
```
# plasma exit [child_chain_address]
plasma exit 0xcc9581513771666c47b5f664024B2f47d5C08bD3
```

## EmbarkJS-Plasma
This project depends on [`embarkjs-plasma`]() which extends EmbarkJS and makes convenience commands available to the DApp in the browser.

## Example DApp
The [`embark-plasma-demo`](https://github.com/embark-framework/embark-plasma-demo) is an example DApp using this plugin. It is based on the OMG [`js-starter-kit`](https://github.com/omisego/js-starter-kit), but instead uses `EmbarkJS.Plasma` for all its functionality.

#### Please report any other issues you find, thank you!
