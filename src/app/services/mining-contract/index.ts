import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { Observable } from "rxjs";
import Web3 from "web3";
import { AppConfig } from "../../appconfig";
import { ContractService } from "../contract";
import { MetamaskService } from "../web3";
import { Contract } from "web3-eth-contract";

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
  private mineManagerContract: Contract;
  private mineContracts: { [id: string]: Contract; } = {};

  constructor(config: AppConfig, contractService: ContractService) {
    this.web3Service = new MetamaskService(config);
    contractService.accountSubscribe().subscribe(async (account: any) => {
      if (account) {
        this.isActive = true;
        this.account = account;
        this.contractData = contractService.CONTRACTS_PARAMS;

        await this.initializeContracts();
        this.callAllAccountsSubscribers();
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

    this.getMineContracts();
  }

  private getMineContracts() {
    const mineAddresses = []; //await getMineAddresses();

    const mineContracts = {};

    for (const mineAddress of mineAddresses) {
      mineContracts[mineAddress] = this.web3Service.getContract(this.contractData.Mine.ABI, mineAddress);
    }

    this.mineContracts = mineContracts;
  }

  public getMineAddresses(): Promise<string[]> {
    return this.mineManagerContract.methods.getMineAddresses().call();
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

  public getDecimals(lpTokenAddress): Promise<any> {
    const TOKEN = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, lpTokenAddress)
    return TOKEN.methods.decimals().call();
  }

  public async getPoolTokens(lpTokenAddress): Promise<any> {
    if (!Web3.utils.isAddress(lpTokenAddress)) {
      throw new Error("Invalid address");
    }

    const UNI_PAIR_CONTRACT = this.web3Service.getContract(this.contractData.UniswapPair.ABI, lpTokenAddress);

    // GET PAIR (token0 and token1)
    const token0 = await UNI_PAIR_CONTRACT.methods.token0().call();
    const token1 = await UNI_PAIR_CONTRACT.methods.token1().call();

    // GET token symbol for ach token in pair
    const BASE_TOKEN_CONTRACT = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, token0)
    const base = await BASE_TOKEN_CONTRACT.methods.symbol().call();

    const MARKET_TOKEN_CONTRACT = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, token1)
    const market = await MARKET_TOKEN_CONTRACT.methods.symbol().call();

    return {
      base,
      market
    };
  }

  public async getTokenBalance(lpTokenAddress, address): Promise<any> {
    const TOKEN = this.web3Service.getContract(this.contractData.UniswapERC20Pair.ABI, lpTokenAddress);

    const balance = await TOKEN.methods.balanceOf(address).call();
    const decimals = await TOKEN.methods.decimals().call();

    const bigBalance = new BigNumber(balance);

    return {
      wei: balance,
      weiBigNumber: bigBalance,
      shortBigNumber: bigBalance.div(new BigNumber(10).pow(decimals)),
      display: bigBalance.div(new BigNumber(10).pow(decimals)).toFormat(2),
    };
  }

  public async getPools(): Promise<any[]> {
    let pools = [
      {
        address: "0xaadb00551312a3c2a8b46597a39ef1105afb2c08",
        startBlock: 11686417,
        endBlock: 11752227,
        rewardPool: new BigNumber("5000000000000000000000000000"),
        isLive: true
      },
      {
        address: "0xd7f7c34dd455efafce52d8845b2646c790db0cdd",
        startBlock: 11686417,
        endBlock: 11752227,
        rewardPool: new BigNumber("1000000000000000000000000000"),
        isLive: false
      }
    ]

    // Get the tokens for the pools
    let promises = [];
    pools.forEach(p => {
      promises.push(this.getPoolTokens(p.address));
    })

    const tokens = await Promise.all(promises)
    tokens.forEach((t, idx) => {
      pools[idx]["base"] = t.base;
      pools[idx]["market"] = t.market;
    })

    return pools;
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

  public async getMinerPoolBalance(mineAddress: string) {
    const minerInfo = await this.mineContracts[mineAddress].methods.minerInfo(this.account.address).call();

    return minerInfo.lpDeposit;
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