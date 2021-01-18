import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { Observable } from "rxjs";
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
        this.callAllAccountsSubscribers();
      }
    });
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

  // TODO: implement this.
  public async isManager(address) {
    return address !== "";
  }

  public getDecimals(lpTokenAddress): any {
    const TOKEN = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapPair.ABI, lpTokenAddress)
    return TOKEN.methods.decimals().call();
  }

  public getTokenBalance(lpTokenAddress, address): any {
    const TOKEN = this.web3Service.getContract(this.contractService.CONTRACTS_PARAMS.UniswapPair.ABI, lpTokenAddress)
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
      } catch (err) {
        reject(err)
      }
    })
  }

  public async withdraw(type) {
    return new Promise((resolve, reject) => {
      let methodName;

      if (type === "LP") methodName = "withdrawLP";
      else if (type === "REWARDS") methodName = "withdrawRewards";
      else if (type === "ALL") methodName = "withdrawAll";

      // TODO: implement
      console.log(methodName)
      resolve(null)
    })
  }
}