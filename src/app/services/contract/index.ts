import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import * as moment from "moment";
import { Observable, Subscriber } from "rxjs";
import { Contract } from "web3-eth-contract";
import { environment } from '../../../environments/environment';
import { AppConfig } from "../../appconfig";
import { MetamaskService } from "../web3";

// export const stakingMaxDays = 5555;
export const stakingMaxDays = 1820;

export interface Stake {
  start: Date;
  end: Date;
  shares: BigNumber;
  amount: BigNumber;
  sessionId: string;
  bigPayDay: BigNumber;
  interest: BigNumber;
  penalty: BigNumber;
  payout: BigNumber;
  withdrawProgress?: boolean;
  forWithdraw: BigNumber;
  isBpdWithdraw: boolean;
  isBpdWithdrawn: boolean;
  isMatured: boolean;
  isWithdrawn: boolean;
}

@Injectable({
  providedIn: "root",
})
export class ContractService {
  private web3Service;

  private H2TContract: Contract;
  private HEX2XContract: Contract;
  private HEXContract: Contract;
  private NativeSwapContract: Contract;

  private StakingContract: Contract;
  private UniswapV2Router02: Contract;
  private Auction: Contract;

  private ForeignSwapContract: Contract;
  private BPDContract: Contract;
  private SubBalanceContract: Contract;

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

  private swapDaysPeriod: any;
  private secondsInDay: any;
  private startDate: any;
  private leftDays: any;

  private CONTRACTS_PARAMS: any;

  public AxnTokenAddress = "none";

  private dayEndSubscribers: Subscriber<any>[] = [];

  private discountPercent: number;
  private premiumPercent: number;

  constructor(private httpService: HttpClient, private config: AppConfig) {
    setInterval(() => {
      if (!(this.secondsInDay && this.startDate)) {
        return;
      }
      const oldLeftDays = this.leftDays;

      const finishDate =
        this.startDate * 1000 + this.swapDaysPeriod * this.secondsInDay * 1000;
      this.leftDays = Math.floor(
        (finishDate - new Date().getTime()) / (this.secondsInDay * 1000)
      );

      if (oldLeftDays) {
        if (oldLeftDays !== this.leftDays) {
          this.dayEndSubscribers.forEach((obs) => {
            obs.next();
          });
        }
      }
    }, 60000);
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

  private initAll() {
    const promises = [
      this.httpService
        .get(`${environment.configDomain}/settings.json`)
        .toPromise()
        .then((config) => {
          if (config) {
            this.settingsApp = config as any;
            this.config.setConfig(config);
          } else {
            this.config.setConfig(this.settingsApp);
          }
        })
        .catch((err) => {
          console.log("err settings", err);
          this.config.setConfig(this.settingsApp);
        }),
      this.httpService
        .get(`${environment.configDomain}/constants.json`)
        .toPromise()
        .then((result) => {
          return result;
        })
        .catch((err) => {
          console.log("err constants", err);
        }),
    ];

    return Promise.all(promises).then((result) => {
      const IS_PRODUCTION = environment.production;
      this.CONTRACTS_PARAMS =
        result[1][
          IS_PRODUCTION ? "mainnet" : this.settingsApp.settings.network
        ];
      this.isActive = true;
      if (this.account) {
        this.callAllAccountsSubscribers();
      }
    });
  }

  public addToken() {
    this.web3Service.addToken({
      address: this.CONTRACTS_PARAMS.HEX2X.ADDRESS,
      decimals: this.tokensDecimals.HEX2X,
      image:
        "https://axiondev.rocknblock.io/assets/images/icons/axion-icon.svg",
      symbol: "AXN",
    });
  }

  private getTokensInfo(noEnable?) {
    if (!noEnable) {
      this.initializeContracts();
    }
    const promises = [
      this.H2TContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.H2T = decimals;
        }),
      this.HEX2XContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.HEX2X = decimals;
        }),
      this.HEXContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.HEX = decimals;
        }),
    ];
    return Promise.all(promises);
  }

  public getStaticInfo() {
    return this.initAll().then(() => {
      this.web3Service = new MetamaskService(this.config);
      this.web3Service.getAccounts().subscribe(async (account: any) => {
        if (account) {
          this.initializeContracts();
          this.discountPercent = +await this.Auction.methods
            .discountPercent()
            .call();

          this.premiumPercent = +await this.Auction.methods
            .premiumPercent()
            .call();
          const promises = [this.getTokensInfo(false)];
          return Promise.all(promises);
        }
      });
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

  public updateClaimableInformation(callEmitter?) {
    return this.ForeignSwapContract.methods
      .getUserClaimableAmountFor(this.account.snapshot.hex_amount)
      .call()
      .then((result) => {
        this.account.claimableInfo = {
          claim: new BigNumber(result[0]),
          penalty: new BigNumber(result[1]),
        };
        if (callEmitter) {
          this.callAllAccountsSubscribers();
        }
      });
  }

  public updateClaimableInformationHex(callEmitter?) {
    return this.ForeignSwapContract.methods
      .claimedBalanceOf(this.account.snapshot.user_address)
      .call()
      .then((result) => {
        this.account.completeClaim = {
          hasClaimed: new BigNumber(result).toNumber() > 0,
          value: new BigNumber(result).div(10000000000).toNumber(),
          valueFull: new BigNumber(result),
        };
        if (callEmitter) {
          this.callAllAccountsSubscribers();
        }
      });
  }

  public transactionsSubscribe() {
    const newObserver = new Observable((observer) => {
      this.allTransactionSubscribers.push(observer);
    });
    return newObserver;
  }

  public getAccount(noEnable?) {
    const finishIniAccount = () => {
      if (!noEnable) {
      }
      if (this.account) {
        this.initializeContracts();
        this.getAccountSnapshot().then(() => {
          this.updateClaimableInformation(true);
          this.updateClaimableInformationHex(true);
        });
      } else {
        this.callAllAccountsSubscribers();
      }
    };
    return new Promise((resolve, reject) => {
      this.web3Service.getAccounts(noEnable).subscribe(
        (account) => {
          if (!this.account || account.address !== this.account.address) {
            this.account = account;
            finishIniAccount();
          }
          resolve(this.account);
        },
        (err) => {
          this.account = false;
          finishIniAccount();
          reject(err);
        }
      );
    });
  }

  public getSnapshotInfo() {
    const promises = [
      this.ForeignSwapContract.methods
        .getCurrentClaimedAddresses()
        .call()
        .then((claimedAddresses) => {
          return {
            key: "claimedAddresses",
            value: claimedAddresses,
          };
        }),
      this.ForeignSwapContract.methods
        .getTotalSnapshotAddresses()
        .call()
        .then((totalAddresses) => {
          return {
            key: "totalAddresses",
            value: totalAddresses,
          };
        }),
      this.ForeignSwapContract.methods
        .getCurrentClaimedAmount()
        .call()
        .then((claimedAmount) => {
          return {
            key: "claimedAmount",
            value: new BigNumber(claimedAmount).div(10000000000),
          };
        }),
      this.ForeignSwapContract.methods
        .getTotalSnapshotAmount()
        .call()
        .then((totalAmount) => {
          return {
            key: "totalAmount",
            value: new BigNumber(totalAmount).div(10000000000),
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const info = {};
      results.forEach((params) => {
        info[params.key] = params.value;
      });
      return info;
    });
  }

  public updateH2TBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.H2TContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.H2T = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.H2T)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.H2T))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public updateHEX2XBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.HEX2XContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.HEX2X = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.H2T)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.H2T))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public updateHEXBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.HEXContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.HEX = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.HEX)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.HEX))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
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
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public getCoinsDecimals() {
    return this.tokensDecimals;
  }

  public loadAccountInfo() {
    const promises = [
      this.updateH2TBalance(),
      this.updateHEX2XBalance(),
      this.updateETHBalance(),
      this.updateHEXBalance(),
    ];
    Promise.all(promises).then(() => {
      this.callAllAccountsSubscribers();
    });
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

  private checkH2TApproval(amount, address?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.H2TContract.methods
        .allowance(this.account.address, address)
        .call()
        .then((allowance: string) => {
          const allow = new BigNumber(allowance);
          const allowed = allow.minus(amount);
          allowed.isNegative() ? reject() : resolve();
        });
    });
  }

  private checkHEX2XApproval(amount, address?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.HEX2XContract.methods
        .allowance(this.account.address, address)
        .call()
        .then((allowance: string) => {
          const allow = new BigNumber(allowance);
          const allowed = allow.minus(amount);
          allowed.isNegative() ? reject() : resolve();
        });
    });
  }

  public swapH2T(amount) {
    const fromAccount = this.account.address;

    const exchangeTokens = (resolve, reject) => {
      return this.NativeSwapContract.methods
        .deposit(amount)
        .send({
          from: fromAccount,
        })
        .then((res) => {
          return this.checkTransaction(res);
        })
        .then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkH2TApproval(
        amount,
        this.NativeSwapContract.options.address
      ).then(
        () => {
          exchangeTokens(resolve, reject);
        },
        () => {
          this.H2TContract.methods
            .approve(this.NativeSwapContract.options.address, amount)
            .send({
              from: fromAccount,
            })
            .then(() => {
              exchangeTokens(resolve, reject);
            }, reject);
        }
      );
    });
  }

  public swapTokenBalanceOf(noConverted?) {
    return this.NativeSwapContract.methods
      .swapTokenBalanceOf(this.account.address)
      .call()
      .then((balance) => {
        if (noConverted) {
          return balance;
        }

        return {
          value: new BigNumber(balance).div(
            new BigNumber(10).pow(this.tokensDecimals.H2T)
          ),
          fullValue: new BigNumber(balance),
          fullValueNotBN: balance,
          fullValueNumber: Number(balance),
        };
      });
  }

  public withdrawH2T() {
    return this.swapTokenBalanceOf(true).then((value) => {
      return this.NativeSwapContract.methods
        .withdraw(value)
        .send({
          from: this.account.address,
        })
        .then((res) => {
          return this.checkTransaction(res);
        });
    });
  }

  public swapNativeToken() {
    return this.NativeSwapContract.methods
      .swapNativeToken()
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public getContractsInfo() {
    const promises = [
      this.Auction.methods
        .calculateStepsFromStart()
        .call()
        .then((auctionId) => {
          return this.Auction.methods
            .reservesOf(auctionId)
            .call()
            .then((res) => {
              return {
                key: "Auction",
                value: new BigNumber(res[1])
                  .div(Math.pow(10, this.tokensDecimals.HEX2X))
                  .toString(),
              };
            });
        }),
      this.HEX2XContract.methods
        .totalSupply()
        .call()
        .then((res) => {
          return {
            key: "totalSupply",
            value: new BigNumber(res)
              .div(Math.pow(10, this.tokensDecimals.HEX2X))
              .toString(),
          };
        }),
      this.StakingContract.methods
        .sharesTotalSupply()
        .call()
        .then((res) => {
          return {
            key: "staking",
            value: new BigNumber(res)
              .div(Math.pow(10, this.tokensDecimals.HEX2X))
              .toString(),
          };
        }),
      this.BPDContract.methods
        .getPoolYearAmounts()
        .call()
        .then((res) => {
          return {
            key: "BPDInfo",
            value: res.map((oneBigPayDay) => {
              return new BigNumber(oneBigPayDay)
                .div(Math.pow(10, this.tokensDecimals.HEX2X))
                .toString();
            }),
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const info = {};
      results.forEach((params) => {
        info[params.key] = params.value;
      });
      return info;
    });
  }

  public getAuctionPool() {
    return new Promise(async (resolve) => {
      const currentAuctionId = await this.Auction.methods
        .calculateStepsFromStart()
        .call();

      const auctionReserves = await this.Auction.methods
        .reservesOf(currentAuctionId)
        .call();

      const data = {} as any;

      data.eth = new BigNumber(auctionReserves.eth);

      data.axn = parseFloat(
        new BigNumber(auctionReserves.token)
          .div(this.ETHER)
          .toFixed(8)
          .toString()
      );

      let auctionPriceFromPool: BigNumber;

      if (auctionReserves.eth === "0" || auctionReserves.token === "0") {
        auctionPriceFromPool = new BigNumber(0);
      } else {
        auctionPriceFromPool = new BigNumber(auctionReserves.token).div(auctionReserves.eth);
      }

      const amountsOut = await this.getAmountsOutAsync(this.ETHER.toString());

      const uniswapPrice = new BigNumber(amountsOut[1]).div(this.ETHER);

      data.uniAxnPerEth = uniswapPrice;

      data.axnPerEth = this.getCurrentAuctionAxnPerEth(
        auctionPriceFromPool, uniswapPrice, auctionReserves.uniswapMiddlePrice);

      resolve(data);
    });
  }

  private getCurrentAuctionAxnPerEth(
    auctionPriceFromPool: BigNumber, uniswapPrice: BigNumber, uniswapAveragePrice: string) 
      : BigNumber {
    if (auctionPriceFromPool.isZero()) {
      const uniswapDiscountedPrice = this.adjustPrice(uniswapPrice);

      return uniswapDiscountedPrice;
    } else {
      const averagePrice = new BigNumber(uniswapAveragePrice);

      const uniswapDiscountedAveragePrice =
        this.adjustPrice(averagePrice.div(this.ETHER));

      return BigNumber.minimum(
        uniswapDiscountedAveragePrice,	
        auctionPriceFromPool
      );
    }
  }

  public getEndDateTime() {
    return this.ForeignSwapContract.methods
      .stepTimestamp()
      .call()
      .then((secondsInDay) => {
        return this.ForeignSwapContract.methods
          .stakePeriod()
          .call()
          .then((swapDaysPeriod) => {
            const allDaysSeconds = swapDaysPeriod * secondsInDay * 1000;
            return this.ForeignSwapContract.methods
              .start()
              .call()
              .then((startDate) => {
                const fullStartDate = startDate * 1000;
                const endDateTime = fullStartDate + allDaysSeconds;

                this.swapDaysPeriod = swapDaysPeriod;
                this.secondsInDay = secondsInDay;
                this.startDate = startDate;

                const a = new Date(endDateTime).getTime();
                const b = Date.now();

                const leftDays = Math.floor((a - b) / (this.secondsInDay * 1000));

                const dateEnd = leftDays;
                const showTime = leftDays;

                return {
                  startDate: fullStartDate,
                  endDate: endDateTime,
                  dateEnd,
                  leftDays,
                  showTime,
                };
              });
          });
      });
  }

  public getEndDateTimeCurrent() {
    return new Promise((resolve) => {
      const allDaysSeconds = this.swapDaysPeriod * this.secondsInDay * 1000;
      const fullStartDate = this.startDate * 1000;
      const endDateTime = fullStartDate + allDaysSeconds;

      const a = new Date(endDateTime).getTime();
      const b = Date.now();

      const leftDays = Math.floor((a - b) / (this.secondsInDay * 1000));
      const dateEnd = leftDays;
      const showTime = leftDays;

      resolve({
        startDate: fullStartDate,
        endDate: endDateTime,
        dateEnd,
        leftDays,
        showTime,
      });
    });
  }

  public readSwapNativeToken() {
    return this.swapTokenBalanceOf(true).then((value) => {
      return this.NativeSwapContract.methods
        .calculateDeltaPenalty(value)
        .call()
        .then((res) => {
          return res;
        });
    });
  }

  public calculatePenalty(amount) {
    return this.NativeSwapContract.methods
      .calculateDeltaPenalty(amount.toString())
      .call()
      .then((res) => {
        return res;
      });
  }

  public depositHEX2X(amount, days) {
    const fromAccount = this.account.address;
    const depositTokens = (resolve, reject) => {
      return this.StakingContract.methods
        .stake(amount, days)
        .send({
          from: fromAccount,
        })
        .then((res) => {
          return this.checkTransaction(res);
        })
        .then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkHEX2XApproval(
        amount,
        this.StakingContract.options.address
      ).then(
        () => {
          depositTokens(resolve, reject);
        },
        () => {
          this.HEX2XContract.methods
            .approve(this.StakingContract.options.address, amount)
            .send({
              from: fromAccount,
            })
            .then(() => {
              depositTokens(resolve, reject);
            }, reject);
        }
      );
    });
  }

  public getStakingContractInfo() {
    const promises = [
      this.StakingContract.methods
        .startContract()
        .call()
        .then((startContract) => {
          return this.StakingContract.methods
            .stepTimestamp()
            .call()
            .then((stepTimestamp) => {
              const result =
                (Math.round(Date.now() / 1000) - startContract) / stepTimestamp;
              return {
                key: "StepsFromStart",
                value: result === Infinity ? 0 : result,
              };
            });
        }),
      this.StakingContract.methods
        .shareRate()
        .call()
        .then((result) => {
          return {
            key: "ShareRate",
            value: result,
          };
        }),
      this.SubBalanceContract.methods
        .getClosestYearShares()
        .call()
        .then((result) => {
          return {
            key: "closestYearShares",
            value: result,
          };
        }),
      this.BPDContract.methods
        .getClosestPoolAmount()
        .call()
        .then((result) => {
          return {
            key: "closestPoolAmount",
            value: result,
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const values = {};
      results.forEach((v) => {
        values[v.key] = v.value;
      });
      return values;
    });
  }

  public getDaysInYear() {
    return new Promise((resolve) => {
      this.SubBalanceContract.methods
        .basePeriod()
        .call()
        .then((result) => {
          resolve(result);
        });
    });
  }

  public async geBPDInfo() {
    const promises = [
      this.getDaysInYear().then((daysInYear) => {
        return {
          key: "daysInYear",
          value: daysInYear,
        };
      }),
      this.getContractsInfo().then((contracts) => {
        return {
          key: "contracts",
          value: contracts,
        };
      }),
      this.SubBalanceContract.methods
        .getStartTimes()
        .call()
        .then((getStartTimes) => {
          return {
            key: "contractsStartTimes",
            value: getStartTimes,
          };
        }),
      this.getEndDateTime().then((dateInfo) => {
        return {
          key: "dateInfo",
          value: dateInfo,
        };
      }),
      this.StakingContract.methods
        .stepTimestamp()
        .call()
        .then((stepTimestamp) => {
          return {
            key: "stepTimestamp",
            value: stepTimestamp,
          };
        }),
    ];

    const results = await Promise.all(promises);
    const values = {} as any;

    results.forEach((v) => {
      values[v.key] = v.value;
    });

    const bpdInfo = values;
    const bpd = [];
    let count = 0;

    bpdInfo.contracts.BPDInfo.map((value) => {
      const data = {
        value: 0,
        year: 0,
        dateEnd: 0,
        daysLeft: 0,
        show: true,
        seconds: 0,
      };

      data.value = value;
      data.year =
        count > 0
          ? bpdInfo.daysInYear * (count + 1)
          : Number(bpdInfo.daysInYear);

      data.dateEnd = bpdInfo.contractsStartTimes[count] * 1000;

      data.daysLeft = Math.round(
        (data.dateEnd - Date.now()) / (bpdInfo.stepTimestamp * 1000)
      );

      const a = moment(new Date(data.dateEnd));
      const b = moment(new Date());

      data.daysLeft = a.diff(
        b,
        this.settingsApp[this.settingsApp.settings.time.display].lowerName
      );
      data.seconds = a.diff(b, "seconds");

      data.show = a.diff(b, "seconds") < 0 ? false : true;

      bpd.push(data);

      count++;
    });

    return bpd;
  }

  public async getWalletStakesAsync(): Promise<{
    closed: Stake[];
    opened: Stake[];
    matured: Stake[];
  }> {
    const walletStakeIds = await this.StakingContract.methods
      .sessionsOf_(this.account.address)
      .call();

    const nowMs = Date.now();
    const stakePromises: Stake[] = walletStakeIds.map(
      async (stakeId) => {
        const stakeSession = await this.StakingContract.methods
          .sessionDataOf(this.account.address, stakeId)
          .call();

        const bigPayDayPayout = await this.SubBalanceContract.methods
          .calculateSessionPayout(stakeId)
          .call();

        const bigPayDaySession = await this.SubBalanceContract.methods
          .stakeSessions(stakeId)
          .call();

        const endMs = stakeSession.end * 1000;
        const amount = new BigNumber(stakeSession.amount);
        const bigPayDay = new BigNumber(bigPayDayPayout[0]);

        const stake : Stake = {
          start: new Date(stakeSession.start * 1000),
          end: new Date(endMs),
          shares: new BigNumber(stakeSession.shares),
          amount: amount,
          sessionId: stakeId,
          bigPayDay: bigPayDay,
          interest: null,
          penalty: null,
          payout: null,
          forWithdraw: null,
          isMatured: nowMs > endMs,
          isWithdrawn: stakeSession.withdrawn,
          isBpdWithdraw: stakeSession.withdrawn && !bigPayDay.isZero(),
          isBpdWithdrawn: bigPayDaySession.withdrawn
        }

        if (!stakeSession.withdrawn) {
          const stakingInterest = await this.StakingContract.methods
            .calculateStakingInterest(
              stakeId,
              this.account.address,
              stakeSession.shares
            )
            .call();

          const payoutAndPenalty = await this.StakingContract.methods
            .getAmountOutAndPenalty(stakeId, stakingInterest)
            .call({ from: this.account.address });

          stake.interest = new BigNumber(stakingInterest);
          stake.penalty = new BigNumber(payoutAndPenalty[1]);
          stake.forWithdraw = new BigNumber(payoutAndPenalty[0]);
        } else {
          stake.payout = new BigNumber(stakeSession.interest).plus(bigPayDay);
          stake.interest = stake.payout.minus(amount);
        }

        return stake;
      }
    );
    
    const walletStakes = await Promise.all(stakePromises);

    return {
      closed: walletStakes.filter((stake: Stake) => {
        return stake.isWithdrawn && !stake.isBpdWithdraw || stake.isBpdWithdrawn;
      }),
      opened: walletStakes.filter((stake: Stake) => {
        return !stake.isMatured && !stake.isWithdrawn || stake.isBpdWithdraw && !stake.isBpdWithdrawn;
      }),
      matured: walletStakes.filter((stake: Stake) => {
        return stake.isMatured && !stake.isWithdrawn || stake.isBpdWithdraw && !stake.isBpdWithdrawn;
      })
    };
  }

  public unstake(sessionId) {
    return this.StakingContract.methods
      .unstake(sessionId)
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public getSessionStats(sessionId) {
    return this.SubBalanceContract.methods
      .getSessionStats(sessionId)
      .call()
      .then((res) => {
        return res;
      });
  }

  public stakingWithdraw(sessionId) {
    return this.SubBalanceContract.methods
      .withdrawPayout(sessionId)
      .call()
      .then((res) => {
        return res;
      });
  }

  public async sendMaxETHToAuction(amount, ref?) {
    const date = Math.round(
      (new Date().getTime() + 24 * 60 * 60 * 1000) / 1000
    );
    const refLink = ref
      ? ref.toLowerCase()
      : "0x0000000000000000000000000000000000000000".toLowerCase();

    const gasLimit = this.account.balances.ETH.wei;
    const gasPrice = await this.web3Service.gasPrice();
    const estimatedGas = await this.Auction.methods.bet(0, date, refLink)
      .estimateGas({from: this.account.address, gas:gasLimit, value: amount});

    const newAmount = new BigNumber(amount).minus(estimatedGas * gasPrice);
    if (newAmount.isNegative()) {
      throw new Error("Not enough gas")
    }

    const amountOutMin = await this.getAmountOutMinAsync(newAmount.toString());

    return this.Auction.methods
      .bet(amountOutMin, date, refLink)
      .send({
        from: this.account.address,
        value: newAmount,
        gasPrice,
        gasLimit: estimatedGas,
      })
      .then((res) => {
        return this.checkTransaction(res)
      });
  }

  public async sendETHToAuction(amount, ref?) {
    const date = Math.round(
      (new Date().getTime() + 24 * 60 * 60 * 1000) / 1000
    );
    const refLink = ref
      ? ref.toLowerCase()
      : "0x0000000000000000000000000000000000000000".toLowerCase();

    const amountOutMin = await this.getAmountOutMinAsync(amount);

    return this.Auction.methods
      .bet(amountOutMin, date, refLink)
      .send({
        from: this.account.address,
        value: amount,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  private async getAmountOutMinAsync(amount: string) : Promise<string> {
    const amountOut = new BigNumber((await this.getAmountsOutAsync(amount))[1]);
    return amountOut.times(
      (100 - environment.slippageTolerancePercent - environment.auctionRecipientPercent) / 100)
        .dp(0).toString(10);
  }

  private getAmountsOutAsync(amount: string) : Promise<string[]> {
    return this.UniswapV2Router02.methods
      .getAmountsOut(amount, [
        this.CONTRACTS_PARAMS.WETH.ADDRESS,
        this.CONTRACTS_PARAMS.HEX2X.ADDRESS
      ])
      .call();
  }

  public getAuctionsData(todaysAuctionId: number, start: number) {
    todaysAuctionId = +todaysAuctionId;

    const oneDayInMS = this.secondsInDay * 1000;

    const tomorrowsAuctionId = todaysAuctionId + 1;
    const nextWeeklyAuctionId = 7 * Math.ceil(todaysAuctionId === 0 ? 1 : todaysAuctionId / 7);

    const auctionIds = [todaysAuctionId, tomorrowsAuctionId];

    for (let i = 1; i <= 7; i++) {
      const previousAuctionId = todaysAuctionId - i;

      if (previousAuctionId >= 0){
        auctionIds.unshift(previousAuctionId);
      } else {
        break;
      }
    }

    if (nextWeeklyAuctionId !== todaysAuctionId && nextWeeklyAuctionId !== tomorrowsAuctionId) {
      auctionIds.push(nextWeeklyAuctionId);
    }

    const nowDateTS = new Date().getTime();
    const auctionsPromises = auctionIds.map((id) => {
      return this.Auction.methods
        .reservesOf(id)
        .call()
        .then((auctionData) => {
          const startDateTS = start + oneDayInMS * id;
          const endDateTS = startDateTS + oneDayInMS;
          const axnInPool = new BigNumber(auctionData.token);
          const ethInPool = new BigNumber(auctionData.eth);

          const auction = {
            id: id,
            isWeekly: id % 7 === 0,
            time: {
              date: moment(startDateTS),
              state: (nowDateTS > startDateTS && nowDateTS < endDateTS) ?
                'progress' : (nowDateTS > endDateTS) ? 'finished' : 'feature',
            },
            data: {
              axnInPool: axnInPool,
              ethInPool: ethInPool
            },
            axnPerEth: null
          };

          if (auction.time.state === 'finished') {
            auction.axnPerEth = this.getAuctionAxnPerEth(axnInPool, ethInPool, auctionData.uniswapMiddlePrice);
          }

          return auction;
        });
    });

    return Promise.all(auctionsPromises).then((results) => {
      return results.sort((auction1, auction2) => {
        return auction1.id < auction2.id ? 1 : auction1.id > auction2.id ? -1 : 0;
      });
    });
  }

  public getAuctions() {
    return new Promise(async (resolve) => {
      const startMs = await this.Auction.methods
        .start()
        .call() * 1000;

      const auctionId = await this.Auction.methods
        .calculateStepsFromStart()
        .call();

      resolve(await this.getAuctionsData(auctionId, startMs));
    });
  }

  public getUserAuctions() {
    return this.Auction.methods
      .start()
      .call()
      .then((start) => {
        return this.Auction.methods
          .auctionsOf_(this.account.address)
          .call()
          .then((result) => {
            const auctionsPromises = result.map((id) => {
              return this.Auction.methods
                .reservesOf(id)
                .call()
                .then((auctionData) => {
                  const auctionInfo = {
                    auctionId: id,
                    startDate: null,
                    axnInPool: new BigNumber(auctionData.token),
                    ethInPool: new BigNumber(auctionData.eth),
                    ethBid: null,
                    winnings: null,
                    hasWinnings: null,
                    status: null,
                    axnPerEth: null
                  };
                  return this.Auction.methods
                    .auctionBetOf(id, this.account.address)
                    .call()
                    .then(async (accountBalance) => {

                      auctionInfo.ethBid = new BigNumber(accountBalance.eth);

                      const startTS = (+start + this.secondsInDay * id) * 1000;
                      const endTS = moment(startTS + this.secondsInDay * 1000);

                      auctionInfo.startDate = new Date(startTS);

                      const uniswapPriceWithPercent = this.adjustPrice(
                        new BigNumber(auctionData.uniswapMiddlePrice)).div(this.ETHER);

                      const poolPrice = new BigNumber(auctionData.token).div(
                        auctionData.eth
                      );

                      const axnWithoutBorder = poolPrice.times(
                        accountBalance.eth
                      );
                      const axnAmountWithDiscount = new BigNumber(
                        accountBalance.eth
                      ).times(uniswapPriceWithPercent);

                      const userWinnings = BigNumber.minimum(
                        axnAmountWithDiscount,
                        axnWithoutBorder
                      );

                      auctionInfo.winnings = userWinnings.div(this.ETHER);
                      auctionInfo.hasWinnings = auctionInfo.winnings.isPositive();

                      if (
                        accountBalance.ref !==
                        "0x0000000000000000000000000000000000000000"
                      ) {
                        auctionInfo.winnings = auctionInfo.winnings.times(1.1);
                      }

                      const b = moment(new Date());
                      const check = endTS.diff(b);

                      auctionInfo.axnPerEth = this.getAuctionAxnPerEth(
                        auctionInfo.axnInPool, auctionInfo.ethInPool, auctionData.uniswapMiddlePrice);

                      if (check > 0) {
                        auctionInfo.status = "progress";
                      } else {
                        if (!accountBalance.withdrawn) {
                          auctionInfo.status = "withdraw";
                        } else {
                          auctionInfo.status = "complete";
                        }
                      }
                      return auctionInfo;
                    });
                });
            });

            return Promise.all(auctionsPromises);
          });
      });
  }

  private getAuctionAxnPerEth(axnInPool: BigNumber, ethInPool: BigNumber, uniswapMiddlePrice: string) {
    const auctionPriceFromPool = axnInPool.div(!ethInPool.isZero() ? ethInPool : 1);
    const averagePrice = new BigNumber(uniswapMiddlePrice);

    const uniswapDiscountedAveragePrice = this.adjustPrice(averagePrice.div(this.ETHER));

    return BigNumber.minimum(
      uniswapDiscountedAveragePrice,
      auctionPriceFromPool
    );
  }

  private adjustPrice(price: BigNumber) : BigNumber {
    return price.times(1 + (this.discountPercent - this.premiumPercent) / 100);
  }

  public withdrawFromAuction(auctionId) {
    return this.Auction.methods
      .withdraw(auctionId)
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public updateUserSnapshot() {
    this.httpService
      .get(`${environment.freeClaimApi}/addresses/${this.account.address}/`)
      .toPromise()
      .then(
        (result) => {
          this.account.snapshot = result;
          this.account.snapshot.nothingToClaim =
            this.account.snapshot.hex_amount <= 0;
          this.account.snapshot.hexAmount =
            new BigNumber(this.account.snapshot.hex_amount).toNumber() > 0
              ? new BigNumber(
                  this.account.snapshot.hex_amount.div(10000000000).toFixed(0)
                )
              : 0;
        },
        () => {
          this.account.snapshot = {
            user_address: this.account.address,
            nothingToClaim: true,
            hex_amount: "0",
            user_hash: "",
            hash_signature: "",
          };
        }
      );
    this.updateClaimableInformationHex();
  }

  private getAccountSnapshot() {
    return new Promise((resolve) => {
      return this.httpService
        .get(`${environment.freeClaimApi}/addresses/${this.account.address}/`)
        .toPromise()
        .then(
          (result) => {
            this.account.snapshot = result;
            this.account.snapshot.nothingToClaim =
              this.account.snapshot.hex_amount <= 0;
            this.account.snapshot.hexAmount = new BigNumber(
              this.account.snapshot.hex_amount
            )
              .div(10000000000)
              .toNumber();
          },
          () => {
            this.account.snapshot = {
              user_address: this.account.address,
              nothingToClaim: true,
              hex_amount: "0",
              user_hash: "",
              hash_signature: "",
            };
          }
        )
        .finally(() => {
          resolve();
        });
    });
  }

  public claimFromForeign() {
    return this.ForeignSwapContract.methods
      .claimFromForeign(
        this.account.snapshot.hex_amount,
        this.account.snapshot.hash_signature
      )
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  private initializeContracts() {
    this.H2TContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.H2T.ABI,
      this.CONTRACTS_PARAMS.H2T.ADDRESS
    );

    this.HEX2XContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.HEX2X.ABI,
      this.CONTRACTS_PARAMS.HEX2X.ADDRESS
    );

    this.NativeSwapContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.NativeSwap.ABI,
      this.CONTRACTS_PARAMS.NativeSwap.ADDRESS
    );

    this.Auction = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.Auction.ABI,
      this.CONTRACTS_PARAMS.Auction.ADDRESS
    );

    this.StakingContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.Staking.ABI,
      this.CONTRACTS_PARAMS.Staking.ADDRESS
    );

    this.HEXContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.HEX.ABI,
      this.CONTRACTS_PARAMS.HEX.ADDRESS
    );

    this.ForeignSwapContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.ForeignSwap.ABI,
      this.CONTRACTS_PARAMS.ForeignSwap.ADDRESS
    );

    this.BPDContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.BPD.ABI,
      this.CONTRACTS_PARAMS.BPD.ADDRESS
    );

    this.SubBalanceContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.SubBalance.ABI,
      this.CONTRACTS_PARAMS.SubBalance.ADDRESS
    );

    this.UniswapV2Router02 = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.UniswapV2Router02.ABI,
      this.CONTRACTS_PARAMS.UniswapV2Router02.ADDRESS
    );

    this.AxnTokenAddress = this.CONTRACTS_PARAMS.HEX.ADDRESS;

    this.getEndDateTime();
  }
}
