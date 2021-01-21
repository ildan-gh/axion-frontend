import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { Observable } from "rxjs";
import Web3 from "web3";
import { AppConfig } from "../../appconfig";
import { ContractService } from "../contract";
import { MetamaskService } from "../web3";
import { Contract } from "web3-eth-contract";

export interface Mine {
  lpToken: string;
  startBlock: number;
  blockReward: BigNumber;
  rewardBalance: BigNumber;
}

export interface MineInfo {
  lpToken: string;
  rewardToken: string;
  startBlock: string;
  lastRewardBlock: string;
  blockReward: string;
  accRewardPerLPToken: string;
  liqRepNFT: string;
  OG5555_25NFT: string;
  OG5555_100NFT: string;
}

@Injectable({
  providedIn: "root",
})
export class MiningContractService {
  private account;

  private isActive: boolean;
  private allAccountSubscribers = [];
  private web3Service: MetamaskService;
  private allTransactionSubscribers = [];

  private contractData: any;
  private axionContract: Contract;
  private mineManagerContract: Contract;
  private mineContracts: { [id: string]: Contract; } = {};

  public mineAddresses: string[];

  constructor(config: AppConfig, contractService: ContractService) {
    this.web3Service = new MetamaskService(config);
    contractService.accountSubscribe().subscribe(async (account: any) => {
      if (account) {
        this.isActive = true;
        this.account = account;
        this.contractData = contractService.CONTRACTS_PARAMS;
        this.axionContract = contractService.AXNContract;
        
        await this.initializeContracts();
        this.callAllAccountsSubscribers();
        this.account.isManager = await this.checkIsManager();
      }
    });
  }

  public checkIsManager(): Promise<boolean> {
    return this.mineManagerContract.methods.isManager().call({ from: this.account.address });
  }

  private callAllAccountsSubscribers() {
    if (this.isActive) {
      this.allAccountSubscribers.forEach((observer) => {
        observer.next(this.account);
      });
    }
  }

  private callAllTransactionsSubscribers(transaction) {
    this.allTransactionSubscribers.forEach((observer) => {
      observer.next(transaction);
    });
  }

  private checkTransaction(tx) {
    return new Promise((resolve, reject) => {
      this.checkTx(tx, resolve, reject);
    });
  }

  private async initializeContracts() {
    this.mineManagerContract = this.web3Service.getContract(this.contractData.MineManager.ABI, this.contractData.MineManager.ADDRESS);
    this.mineAddresses = []//await this.mineManagerContract.methods.getMineAddresses().call()
    this.getMineContracts();
  }

  private getMineContracts() {
    const mineContracts = {};

    for (const mineAddress of this.mineAddresses) {
      mineContracts[mineAddress] = this.web3Service.getContract(this.contractData.Mine.ABI, mineAddress);
    }

    this.mineContracts = mineContracts;
  }

  private checkTx(tx, resolve, reject) {
    this.web3Service.Web3.eth.getTransaction(tx.transactionHash).then((txInfo) => {
      if (txInfo.blockNumber) {
        this.callAllTransactionsSubscribers(txInfo);
        resolve(tx);
      } else {
        setTimeout(() => {
          this.checkTx(tx, resolve, reject);
        }, 2000);
      }
    }, reject);
  }

  public accountSubscribe() {
    const newObserver = new Observable((observer) => {
      observer.next(this.account);
      this.allAccountSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.allAccountSubscribers = this.allAccountSubscribers.filter(a => a !== newObserver)
        },
      };
    });
    return newObserver;
  }

  public transactionsSubscribe() {
    const newObserver = new Observable((observer) => {
      this.allTransactionSubscribers.push(observer);
    });
    return newObserver;
  }

  public async getPoolTokens(lpTokenAddress: string): Promise<any> {
    if (!Web3.utils.isAddress(lpTokenAddress)) {
      throw new Error("Invalid address");
    }

    const uniPairContract = this.web3Service.getContract(this.contractData.UniswapPair.ABI, lpTokenAddress);

    // Get base token symbol
    const token1 = await uniPairContract.methods.token1().call();
    const baseTokenContract = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, token1)
    const market = await baseTokenContract.methods.symbol().call();

    return {
      base: "AXN",
      market
    };
  }

  public async getTokenBalance(mineAddress: string): Promise<any> {
    const token = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, mineAddress);
    const balance = await token.methods.balanceOf(this.account.address).call();

    return {
      wei: balance,
      weiBigNumber: new BigNumber(balance)
    };
  }

  public async getMines(): Promise<any[]> {
    const mines: Mine[] = [];

    for (const mineAddress of this.mineAddresses) {
      const balance = await this.axionContract.methods.balanceOf(mineAddress).call();
      const mineInfo: MineInfo = await this.mineContracts[mineAddress].methods.mineInfo().call();

      const mine: Mine = {
        lpToken: mineInfo.lpToken,
        startBlock: +mineInfo.startBlock,
        blockReward: new BigNumber(mineInfo.blockReward),
        rewardBalance: new BigNumber(balance)
      };

      mines.push(mine);
    }

    let promises = [];
    mines.forEach(p => {
      promises.push(this.getPoolTokens(p.lpToken));
    })

    const tokens = await Promise.all(promises)
    tokens.forEach((t, idx) => {
      mines[idx]["base"] = t.base;
      mines[idx]["market"] = t.market;
    })

    return mines;
  }

  public getCurrentBlock(): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const latestBlock = await this.web3Service.getBlock();
        resolve(latestBlock.number)
      } catch (err) { reject(err) }
    })
  }

  public depositLPTokens(mineAddress: string, amount: string): Promise<void> {
    return this.mineContracts[mineAddress].methods.depositLPTokens(amount).send();
  }

  public withdrawLPTokens(mineAddress: string, amount: string): Promise<void> {
    return this.mineContracts[mineAddress].methods.depositLPTokens(amount).send();
  }

  public withdrawReward(mineAddress: string): Promise<void> {
    return this.mineContracts[mineAddress].methods.withdrawReward().send();
  }

  public withdrawAll(mineAddress: string): Promise<void> {
    return this.mineContracts[mineAddress].methods.withdrawAll().send();
  }

  public async getPendingReward(mineAddress: string): Promise<BigNumber> {
    const reward = await this.mineContracts[mineAddress].methods.getPendingReward().call();

    return new BigNumber(reward);
  }

  public async getMinerPoolBalance(mineAddress: string): Promise<BigNumber> {
    const minerInfo = await this.mineContracts[mineAddress].methods.minerInfo(this.account.address).call();

    return new BigNumber(minerInfo.lpDeposit);
  }

  public calculateBlockReward(rewardAmount: string, startBlock: number, endBlock: number): BigNumber {
    const blocks = endBlock - startBlock;

    return new BigNumber(rewardAmount).div(blocks);
  }

  public async createMine(lpTokenAddress: string, rewardAmount: string, blockReward: BigNumber, startBlock: number) {
    await this.mineManagerContract.methods.createMine(lpTokenAddress, rewardAmount, blockReward, startBlock).send();

    this.getMineContracts();
  }
}