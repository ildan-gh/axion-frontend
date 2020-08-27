import { CONTRACTS_PARAMS } from './constants';
import { MetamaskService } from '../web3';
import { Contract } from 'web3-eth-contract';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { HttpClient } from '@angular/common/http';

const swapDays = 350;
export const stakingMaxDays = 1820;
const oneDaySeconds = 86400;

interface DepositInterface {
  start: Date;
  end: Date;
  shares: BigNumber;
  amount: BigNumber;
  isActive: boolean;
  sessionId: string;
  bigPayDay: BigNumber;
  withdrawProgress?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private web3Service;

  private H2TContract: Contract;
  private HEX2XContract: Contract;
  private HEXContract: Contract;
  private NativeSwapContract: Contract;
  private DailyAuctionContract: Contract;
  private WeeklyAuctionContract: Contract;
  private StakingContract: Contract;

  private ForeignSwapContract: Contract;
  private BPDContract: Contract;
  private SubBalanceContract: Contract;

  private tokensDecimals: any = {
    ETH: 18
  };
  public account;
  private allAccountSubscribers = [];

  constructor(
    private httpService: HttpClient
  ) {
    this.web3Service = new MetamaskService();
    this.initializeContracts();
  }

  private getTokensInfo() {
    const promises = [
      this.H2TContract.methods.decimals().call().then((decimals) => {
        this.tokensDecimals.H2T = decimals;
      }),
      this.HEX2XContract.methods.decimals().call().then((decimals) => {
        this.tokensDecimals.HEX2X = decimals;
      }),
      this.HEXContract.methods.decimals().call().then((decimals) => {
        this.tokensDecimals.HEX = decimals;
      })
    ];
    return Promise.all(promises);
  }

  public getStaticInfo() {
    const promises = [
      this.getTokensInfo()
    ];
    return Promise.all(promises);
  }

  private callAllAccountsSubscribers() {
    this.allAccountSubscribers.forEach((observer) => {
      observer.next(this.account);
    });
  }

  public accountSubscribe() {
    const newObserver = new Observable((observer) => {
      observer.next(this.account);
      this.allAccountSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.allAccountSubscribers = this.allAccountSubscribers.filter(a => a !== newObserver);
        }
      };
    });
    return newObserver;
  }

  public updateClaimableInformation(callEmitter?) {
    return this.ForeignSwapContract.methods.getUserClaimableAmountFor(this.account.snapshot.hex_amount).call().then((result) => {
      this.account.claimableInfo = {
        claim: result[0],
        penalty: result[1]
      };
      if (callEmitter) {
        this.callAllAccountsSubscribers();
      }
    });
  }

  public getAccount(noEnable?) {
    const finishIniAccount = () => {
      if (!noEnable) {
        this.initializeContracts();
      }
      if (this.account) {
        this.getAccountSnapshot().then(() => {
          this.updateClaimableInformation(true);
        });
      } else {
        this.callAllAccountsSubscribers();
      }
    };
    return new Promise((resolve, reject) => {
      this.web3Service.getAccounts(noEnable).subscribe((account) => {
        if (!this.account || account.address !== this.account.address) {
          this.account = account;
          finishIniAccount();
        }
        resolve(this.account);
      }, (err) => {
        this.account = false;
        finishIniAccount();
        reject(err);
      });
    });
  }

  public updateH2TBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.H2TContract.methods.balanceOf(this.account.address).call().then((balance) => {
        const bigBalance = new BigNumber(balance);
        this.account.balances = this.account.balances || {};
        this.account.balances.H2T = {
          wei: balance,
          weiBigNumber: bigBalance,
          shortBigNumber: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.H2T)),
          display: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.H2T)).toFormat(4)
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
      return this.HEX2XContract.methods.balanceOf(this.account.address).call().then((balance) => {
        const bigBalance = new BigNumber(balance);
        this.account.balances = this.account.balances || {};
        this.account.balances.HEX2X = {
          wei: balance,
          weiBigNumber: bigBalance,
          shortBigNumber: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.H2T)),
          display: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.H2T)).toFormat(4)
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
      return this.HEXContract.methods.balanceOf(this.account.address).call().then((balance) => {
        const bigBalance = new BigNumber(balance);
        this.account.balances = this.account.balances || {};
        this.account.balances.HEX = {
          wei: balance,
          weiBigNumber: bigBalance,
          shortBigNumber: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.HEX)),
          display: bigBalance.div(new BigNumber(10).pow(this.tokensDecimals.HEX)).toFormat(4)
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
      return this.web3Service.getBalance(this.account.address).then((balance) => {
        const bigBalance = new BigNumber(balance);
        this.account.balances = this.account.balances || {};
        this.account.balances.ETH = {
          wei: balance,
          weiBigNumber: bigBalance,
          shortBigNumber: bigBalance.div(new BigNumber(10).pow(18)),
          display: bigBalance.div(new BigNumber(10).pow(18)).toFormat(4)
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
    this.web3Service.Web3.eth.getTransaction(tx.transactionHash).then((txInfo) => {
      if (txInfo.blockNumber) {
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
      this.H2TContract.methods.allowance(this.account.address, address).call().then((allowance: string) => {
        const allow = new BigNumber(allowance);
        const allowed = allow.minus(amount);
        allowed.isNegative() ? reject() : resolve();
      });
    });
  }

  private checkHEX2XApproval(amount, address?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.HEX2XContract.methods.allowance(this.account.address, address).call().then((allowance: string) => {
        const allow = new BigNumber(allowance);
        const allowed = allow.minus(amount);
        allowed.isNegative() ? reject() : resolve();
      });
    });
  }

  public swapH2T(amount) {
    const fromAccount = this.account.address;

    const exchangeTokens = (resolve, reject) => {
      return this.NativeSwapContract.methods.deposit(amount).send({
        from: fromAccount
      }).then((res) => {
        return this.checkTransaction(res);
      }).then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkH2TApproval(amount, this.NativeSwapContract.options.address).then(() => {
        exchangeTokens(resolve, reject);
      }, () => {
        this.H2TContract.methods.approve(this.NativeSwapContract.options.address, amount).send({
          from: fromAccount
        }).then(() => {
          exchangeTokens(resolve, reject);
        }, reject);
      });
    });
  }

  public swapTokenBalanceOf(noConverted?) {
    return this.NativeSwapContract.methods.getSwapTokenBalanceOf(this.account.address).call().then((balance) => {
      if (noConverted) {
        return balance;
      }
      return new BigNumber(balance).div(new BigNumber(10).pow(this.tokensDecimals.H2T));
    });
  }

  public withdrawH2T() {
    return this.swapTokenBalanceOf(true).then((value) => {
      return this.NativeSwapContract.methods.withdraw(value).send({
        from: this.account.address
      }).then((res) => {
        return this.checkTransaction(res);
      });
    });
  }

  public swapNativeToken() {
    return this.NativeSwapContract.methods.swapNativeToken().send({
      from: this.account.address
    }).then((res) => {
      return this.checkTransaction(res);
    });
  }

  public getContractsInfo() {
    const promises = [
      this.DailyAuctionContract.methods.currentAuctionId().call().then((auctionId) => {
        return this.DailyAuctionContract.methods.reservesOf(auctionId).call().then((res) => {
          return {
            key: 'DailyAuction',
            value: new BigNumber(res[1]).div(Math.pow(10, this.tokensDecimals.HEX2X)).toString()
          };
        });
      }),
      this.WeeklyAuctionContract.methods.currentAuctionId().call().then((auctionId) => {
        return this.WeeklyAuctionContract.methods.reservesOf(auctionId).call().then((res) => {
          return {
            key: 'WeeklyAuction',
            value: new BigNumber(res[1]).div(Math.pow(10, this.tokensDecimals.HEX2X)).toString()
          };
        });
      }),
      this.HEX2XContract.methods.totalSupply().call().then((res) => {
        return {
          key: 'totalSupply',
          value: new BigNumber(res).div(Math.pow(10, this.tokensDecimals.HEX2X)).toString()
        };
      }),
      this.StakingContract.methods.sharesTotalSupply().call().then((res) => {
        return {
          key: 'staking',
          value: new BigNumber(res).div(Math.pow(10, this.tokensDecimals.HEX2X)).toString()
        };
      }),
      this.BPDContract.methods.getPoolYearAmounts().call().then((res) => {
        return {
          key: 'BPDInfo',
          value: res.map((oneBigPayDay) => {
            return new BigNumber(oneBigPayDay).div(Math.pow(10, this.tokensDecimals.HEX2X)).toString();
          })
        };
      })
    ];
    return Promise.all(promises).then((results) => {
      const info = {};
      results.forEach((params) => {
        info[params.key] = params.value;
      });
      return info;
    });
  }

  public getEndDateTime() {
    return this.NativeSwapContract.methods.getStepTimestamp().call().then((secondsInDay) => {
      const allDaysSeconds = swapDays * secondsInDay * 1000;
      return this.NativeSwapContract.methods.getStart().call().then((startDate) => {
        const fullStartDate = startDate * 1000;
        const endDateTime = fullStartDate + allDaysSeconds;
        const leftDays = Math.floor((endDateTime - new Date().getTime()) / allDaysSeconds);
        return {
          startDate: fullStartDate,
          endDate: endDateTime,
          leftDays
        };
      });
    });
  }



  /* Staking */
  public depositHEX2X(amount, days) {
    const fromAccount = this.account.address;
    const depositTokens = (resolve, reject) => {
      return this.StakingContract.methods.stake(amount, days).send({
        from: fromAccount
      }).then((res) => {
        return this.checkTransaction(res);
      }).then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkHEX2XApproval(amount, this.StakingContract.options.address).then(() => {
        depositTokens(resolve, reject);
      }, () => {
        this.HEX2XContract.methods.approve(this.StakingContract.options.address, amount).send({
          from: fromAccount
        }).then(() => {
          depositTokens(resolve, reject);
        }, reject);
      });
    });
  }

  public getStakingContractInfo() {
    const promises = [
      this.DailyAuctionContract.methods.calculateStepsFromStart().call().then((result) => {
        return {
          key: 'StepsFromStart',
          value: result
        };
      }),
      this.StakingContract.methods.shareRate().call().then((result) => {
        return {
          key: 'ShareRate',
          value: result
        };
      }),
      this.SubBalanceContract.methods.getClosestYearShares().call().then((result) => {
        return {
          key: 'closestYearShares',
          value: result
        };
      }),
      this.BPDContract.methods.getClosestPoolAmount().call().then((result) => {
        return {
          key: 'closestPoolAmount',
          value: result
        };
      })
    ];
    return Promise.all(promises).then((results) => {
      const values = {};
      results.forEach((v) => {
        values[v.key] = v.value;
      });
      return values;
    });
  }

  public getAccountStakes(): Promise<{closed: DepositInterface[], opened: DepositInterface[]}> {
    return this.StakingContract.methods.sessionsOf_(this.account.address).call().then((sessions) => {
      const sessionsPromises: DepositInterface[] = sessions.map((sessionId) => {
        return this.StakingContract.methods.sessionDataOf(this.account.address, sessionId).call().then((oneSession) => {
          return this.SubBalanceContract.methods.calculateSessionPayout(sessionId).call().then((result) => {
            return {
              start: new Date(oneSession.start * 1000),
              end: new Date(oneSession.end * 1000),
              shares: new BigNumber(oneSession.shares),
              amount: new BigNumber(oneSession.amount),
              isActive: oneSession.sessionIsActive,
              sessionId,
              bigPayDay: new BigNumber(result)
            };
          });
        });
      });
      return Promise.all(sessionsPromises).then((allDeposits: DepositInterface[]) => {
        return {
          closed: allDeposits.filter((deposit: DepositInterface) => {
            return !deposit.isActive;
          }),
          opened: allDeposits.filter((deposit: DepositInterface) => {
            return deposit.isActive;
          })
        };
      });
    });
  }

  public unstake(sessionId) {
    return this.StakingContract.methods.unstake(sessionId).send({
      from: this.account.address
    }).then((res) => {
      return this.checkTransaction(res);
    });
  }


  // Auction
  public getAuctionInfo() {
    const retData = {} as any;
    return this.DailyAuctionContract.methods.currentAuctionId().call().then((auctionId) => {
      const promises = [
        this.DailyAuctionContract.methods.reservesOf(auctionId).call().then((result) => {
          retData.ethPool = result[0];
          retData.axnPool = result[1];
        })
      ];
      if (this.account) {
        promises.push(
          this.DailyAuctionContract.methods.auctionEthBalanceOf(auctionId, this.account.address).call().then((result) => {
            retData.currentUserBalance = result;
          })
        );
      }
      return Promise.all(promises).then(() => {
        return retData;
      });
    });
  }

  public sendETHToAuction(amount) {
    return this.DailyAuctionContract.methods.bet(
      Math.round((new Date().getTime() + 24 * 60 * 60 * 1000) / 1000),
      '0x1e1631579f5Dc88bB372DCD4bE64e7dB503e8416'.toLowerCase()
    ).send({
      from: this.account.address,
      value: amount
    }).then((res) => {
      return this.checkTransaction(res);
    });
  }

  public getUserAuctions() {

    return this.DailyAuctionContract.methods.start().call().then((start) => {
      return this.DailyAuctionContract.methods.auctionsOf_(this.account.address).call().then((result) => {
        const auctionsPromises = result.map((id) => {
          return this.DailyAuctionContract.methods.reservesOf(id).call().then((auctionData) => {
            const auctionInfo = {
              eth: new BigNumber(auctionData.eth),
              token: new BigNumber(auctionData.token),
              accountETHBalance: new BigNumber(0),
              accountTokenBalance: new BigNumber(0),
              auctionId: id,
              start: new Date((+start + oneDaySeconds * id) * 1000)
            };
            return this.DailyAuctionContract.methods.auctionEthBalanceOf(id, this.account.address).call().then((accountBalance) => {
              auctionInfo.accountETHBalance = new BigNumber(accountBalance.eth);
              auctionInfo.accountTokenBalance =
                new BigNumber(accountBalance.eth).multipliedBy(auctionData.token).div(auctionData.eth);
              return auctionInfo;
            });
          });
        });
        return Promise.all(auctionsPromises);
      });
    });
  }

  public withdrawFromAuction(auctionId) {
    return this.DailyAuctionContract.methods.withdraw(auctionId).send({
      from: this.account.address
    }).then((res) => {
      return this.checkTransaction(res);
    });
  }

  private getAccountSnapshot() {
    return new Promise((resolve) => {
      return this.httpService.get(`/api/v1/addresses/${this.account.address}`).toPromise().then((result) => {
        this.account.snapshot = result;
      }, () => {
        this.account.snapshot = {
          user_address: this.account.address,
          hex_amount: '0',
          user_hash: '',
          hash_signature: ''
        };
      }).finally(() => {
        resolve();
      });
    });
  }

  public claimFromForeign() {
    return this.ForeignSwapContract.methods.claimFromForeign(
      this.account.snapshot.hex_amount,
      this.account.snapshot.hash_signature
    ).send({
      from: this.account.address
    }).then((res) => {
      return this.checkTransaction(res);
    });
  }


  private initializeContracts() {
    this.H2TContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.H2T.ABI,
      CONTRACTS_PARAMS.H2T.ADDRESS
    );

    this.HEX2XContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.HEX2X.ABI,
      CONTRACTS_PARAMS.HEX2X.ADDRESS
    );

    this.NativeSwapContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.NativeSwap.ABI,
      CONTRACTS_PARAMS.NativeSwap.ADDRESS
    );

    this.DailyAuctionContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.DailyAuction.ABI,
      CONTRACTS_PARAMS.DailyAuction.ADDRESS
    );

    this.WeeklyAuctionContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.WeeklyAuction.ABI,
      CONTRACTS_PARAMS.WeeklyAuction.ADDRESS
    );

    this.StakingContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.Staking.ABI,
      CONTRACTS_PARAMS.Staking.ADDRESS
    );

    this.HEXContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.HEX.ABI,
      CONTRACTS_PARAMS.HEX.ADDRESS
    );

    this.ForeignSwapContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.ForeignSwap.ABI,
      CONTRACTS_PARAMS.ForeignSwap.ADDRESS
    );

    this.BPDContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.BPD.ABI,
      CONTRACTS_PARAMS.BPD.ADDRESS
    );

    this.SubBalanceContract = this.web3Service.getContract(
      CONTRACTS_PARAMS.SubBalance.ABI,
      CONTRACTS_PARAMS.SubBalance.ADDRESS
    );

  }



}
