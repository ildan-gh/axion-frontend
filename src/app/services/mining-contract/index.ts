import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import * as moment from "moment";
import { Observable, Subscriber } from "rxjs";
import { Contract } from "web3-eth-contract";
import { environment } from "../../../environments/environment";
import { AppConfig } from "../../appconfig";
import { ContractService } from "../contract";
import { MetamaskService } from "../web3";

@Injectable({
  providedIn: "root",
})
export class MiningContractService {
  private web3Service;

  private isActive: boolean;

  private tokensDecimals: any = {
    ETH: 18,
  };

  private readonly ETHER = Math.pow(10, this.tokensDecimals.ETH);

  public account;
  private allAccountSubscribers = [];
  private allTransactionSubscribers = [];
  public settingsApp = {
    settings: {
      checkerDays: 5000,
      checkerAuctionPool: 5000,
      checkerStakingInfo: 3600000,
      checkerBPD: 3600000,
      freeclaimEndTime: 1611859352000, // Jan-28-2021 06:42:32 PM UTC

      production: false,
      network: "ropsten",
      chainsForButtonAddToMetamask: [1, 3, 4],
      net: 3,

      time: {
        seconds: 86400,
        display: "days",
      },
    },
    minutes: {
      name: "Minutes",
      shortName: "Min",
      lowerName: "minutes",
    },
    days: {
      name: "Days",
      shortName: "Days",
      lowerName: "days",
    },
  };

  private secondsInDay: any;
  private startDate: any;
  private leftDays: any;

  private CONTRACTS_PARAMS: any;

  public AxnTokenAddress = "none";

  private dayEndSubscribers: Subscriber<any>[] = [];

  public autoStakeDays: number;

  constructor(private httpService: HttpClient, private config: AppConfig, private contractService: ContractService) {
    this.web3Service = new MetamaskService(config);

    contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (account) {
          this.isActive = true;
          this.account = account;
          this.callAllAccountsSubscribers();
        }
      });
  }

  public getMSecondsInDay() {
    return this.secondsInDay * 1000;
  }

  public onDayEnd() {
    return new Observable((observer) => {
      this.dayEndSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.dayEndSubscribers = this.dayEndSubscribers.filter((obs) => {
            return obs !== observer;
          });
        },
      };
    });
  }

  public addToken() {
    this.web3Service.addToken({
      address: this.CONTRACTS_PARAMS.HEX2X.ADDRESS,
      decimals: this.tokensDecimals.HEX2X,
      image:
        "https://stake.axion.network/assets/images/icons/axion-icon.png",
      symbol: "AXN",
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

  public accountSubscribe() {
    const newObserver = new Observable((observer) => {
      observer.next(this.account);
      this.allAccountSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.allAccountSubscribers = this.allAccountSubscribers.filter(
            (a) => a !== newObserver
          );
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

  public updateETHBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.web3Service
        .getBalance(this.account.address)
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.ETH = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(new BigNumber(10).pow(18)),
            display: bigBalance.div(new BigNumber(10).pow(18)).toFormat(4),
          };
          resolve(null);
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public getCoinsDecimals() {
    return this.tokensDecimals;
  }

  private checkTx(tx, resolve, reject) {
    this.web3Service.Web3.eth
      .getTransaction(tx.transactionHash)
      .then((txInfo) => {
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

  private checkTransaction(tx) {
    return new Promise((resolve, reject) => {
      this.checkTx(tx, resolve, reject);
    });
  }

  private initializeContracts() {
    // this.H2TContract = this.web3Service.getContract(
    //   this.CONTRACTS_PARAMS.H2T.ABI,
    //   this.CONTRACTS_PARAMS.H2T.ADDRESS
    // );

    this.AxnTokenAddress = this.CONTRACTS_PARAMS.HEX.ADDRESS;
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
          decimals: decimals,
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