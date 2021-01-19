import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { Observable } from "rxjs";
import Web3 from "web3";
import { AppConfig } from "../../appconfig";
import { ContractService } from "../contract";
import { MetamaskService } from "../web3";

@Injectable({
  providedIn: "root",
})
export class MiningContractService {
  public account;
  private isActive: boolean;
  public axnTokenAddress: string;
  private allAccountSubscribers = [];
  private web3Service: MetamaskService;
  private allTransactionSubscribers = [];

  constructor(private config: AppConfig, private contractService: ContractService) {
    this.web3Service = new MetamaskService(this.config);
    this.contractService.accountSubscribe().subscribe((account: any) => {
      if (account) {
        this.isActive = true;
        this.account = account;
        
        this.checkRole();
        this.callAllAccountsSubscribers();
      }
    });
  }

  // TODO: Implement (and maybe change name? haha)
  private checkRole() {
    this.account.isManager = true;
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

  private initializeContracts() {
    // this.H2TContract = this.web3Service.getContract(this.CONTRACTS_PARAMS.H2T.ABI, this.CONTRACTS_PARAMS.H2T.ADDRESS);
    this.axnTokenAddress = this.contractService.CONTRACTS_PARAMS.HEX.ADDRESS;
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

  //////////////////
  // PUBLIC METHODS
  //////////////////

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

  public getDecimals(lpTokenAddress): any {
    const TOKEN = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapERC20Pair.ABI, lpTokenAddress)
    return TOKEN.methods.decimals().call();
  }

  public getPoolTokens(lpTokenAddress): any {
    return new Promise(async (resolve, reject) => {
      if (!Web3.utils.isAddress(lpTokenAddress)) {
        reject({message: "Invalid address"})
        return;
      }
      
      try {
        const UNI_PAIR_CONTRACT = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapPair.ABI, lpTokenAddress);

        // GET PAIR (token0 and token1)
        const token0 = await UNI_PAIR_CONTRACT.methods.token0().call();
        const token1 = await UNI_PAIR_CONTRACT.methods.token1().call();
        
        // GET token symbol for ach token in pair
        const BASE_TOKEN_CONTRACT = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapERC20Pair.ABI, token0)
        const base = await BASE_TOKEN_CONTRACT.methods.symbol().call();

        const MARKET_TOKEN_CONTRACT = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapERC20Pair.ABI, token1)
        const market = await MARKET_TOKEN_CONTRACT.methods.symbol().call();

        resolve({
          base,
          market
        })
      } catch (err) { reject(err) }
    })
  }

  public getTokenBalance(lpTokenAddress, address): any {
    const TOKEN = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapERC20Pair.ABI, lpTokenAddress)
    return new Promise(async (resolve, reject) => {
      try {
        const balance = await TOKEN.methods.balanceOf(address).call();
        const decimals = await TOKEN.methods.decimals().call();
        
        const bigBalance = new BigNumber(balance);
        resolve({
          wei: balance,
          weiBigNumber: bigBalance,
          shortBigNumber: bigBalance.div(new BigNumber(10).pow(decimals)),
          display: bigBalance.div(new BigNumber(10).pow(decimals)).toFormat(2),
        })
      } catch (err) { reject(err) }
    })
  }

  public getPools(): Promise<any[]> {
    return new Promise(async (resolve, reject) => {
      try {

        // TODO: Implement
        // SAMPLE DATA
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

        resolve(pools)
      } catch (err) { reject(err) }
    })
  }

  // TODO: Implement
  public deposit(amount) {
    return new Promise(async (resolve, reject) => {
      try {
        resolve(amount)
      } catch (err) { reject (err) }
    })
  }

  // TODO: Implement
  public async withdraw(type) {
    return new Promise((resolve, reject) => {
      try {
        let methodName;

        if (type === "LP") methodName = "withdrawLP";
        else if (type === "REWARDS") methodName = "withdrawRewards";
        else if (type === "ALL") methodName = "withdrawAll";
        resolve(methodName)
      } catch (err) { reject(err) }
    })
  }

  // TODO: Implement
  public async getUserPoolBalance(address) {
    return new Promise((resolve, reject) => {
      try {
        resolve({
          address,
          stakedTokens: new BigNumber(0),
          rewardsEarned: new BigNumber(0)
        })
        resolve(null)
      } catch (err) { reject(err) }
    })
  }

  // TODO: Implement 
  // (MANAGERS ONLY - checked from checkRole())
  public createPool(address, rewardAmount, startBlock, endBlock) {
    return new Promise(async (resolve, reject) => {
      try {
        resolve({ 
          address, 
          rewardAmount, 
          startBlock, 
          endBlock 
        })
      } catch (err) { reject(err) }
    })
  }
}