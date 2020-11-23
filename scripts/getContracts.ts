const fs = require('fs').promises;
require('dotenv').config();

function sleep(ms:number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

(async () => {
  try {
    const {
      ETHERSCAN_API_KEY,
      H2T_ADDRESS,
      WETH_ADDRESS,
      HEX2X_ADDRESS,
      HEX_ADDRESS,
      NATIVE_SWAP_ADDRESS,
      STAKING_ADDRESS,
      BPD_ADDRESS,
      FOREIGN_SWAP_ADDRESS,
      SUB_BALANCE_ADDRESS,
      UNISWAP_V2_ROUTER_02_ADDRESS,
      AUCTION_ADDRESS,
    } = process.env

    const CONFIG = {
      "mainnet": {
        "H2T": {
          "ADDRESS": H2T_ADDRESS,
          "ABI": []
        },
        "WETH": {
          "ADDRESS": WETH_ADDRESS
        },
        "HEX2X": {
          "ADDRESS": HEX2X_ADDRESS,
          "ABI": []
        },
        "HEX": {
          "ADDRESS": HEX_ADDRESS,
          "ABI": []
        },
        "NativeSwap": {
          "ADDRESS": NATIVE_SWAP_ADDRESS,
          "ABI": []
        },
        "Auction": {
          "ADDRESS": AUCTION_ADDRESS,
          "ABI": []
        },
        "Staking": {
          "ADDRESS": STAKING_ADDRESS,
          "ABI": []
        },
        "BPD": {
          "ADDRESS": BPD_ADDRESS,
          "ABI": []
        },
        "ForeignSwap": {
          "ADDRESS": FOREIGN_SWAP_ADDRESS,
          "ABI": []
        },
        "SubBalance": {
          "ADDRESS": SUB_BALANCE_ADDRESS,
          "ABI": []
        },
        "UniswapV2Router02": {
          "ADDRESS": UNISWAP_V2_ROUTER_02_ADDRESS,
          "ABI": []
        }
      }
    }

    // Setup api
    const api = require('etherscan-api').init(ETHERSCAN_API_KEY);

    // Retrieve all ABIs

    for (let i = 0; i < Object.keys(CONFIG.mainnet).length; i++) {
      const contractName = Object.keys(CONFIG.mainnet)[i]
      if (contractName !== "WETH") {
        console.log(`${contractName}: ${CONFIG.mainnet[contractName].ADDRESS}`)
        var abi = await api.contract.getabi(CONFIG.mainnet[contractName].ADDRESS);
        await sleep(1000) // Prevent rate limit of etherscan

        CONFIG.mainnet[contractName].ABI = JSON.parse(abi.result)
      }
    }

    await fs.writeFile(`src/assets/js/constants.json`, JSON.stringify(CONFIG));

    // Settings
    const SETTINGS = {
      "settings": {
        "checkerDays": 3600000,
        "checkerAuctionPool": 15000,
        "checkerStakingInfo": 3600000,
        "checkerBPD": 3600000,

        "chainsForButtonAddToMetamask": [1],
        "network": "mainnet",
        "tonkenUrl": "https://etherscan.io/token/",
        "net": 1,
        "time": {
          "seconds": 86400,
          "display": "days"
        }
      },
      "minutes": {
        "name": "Minutes",
        "shortName": "Min",
        "lowerName": "minutes"
      },
      "days": {
        "name": "Days",
        "shortName": "Days",
        "lowerName": "days"
      }
    }

    await fs.writeFile(`src/assets/js/settings.json`, JSON.stringify(SETTINGS));

  } catch(e) {
    console.info(e)
  }


// var abi = await api.contract.getabi('0xE95aA33A946d533940832ebfd6fa53Fe95e12060');
// console.log('balance', balance);
})()
