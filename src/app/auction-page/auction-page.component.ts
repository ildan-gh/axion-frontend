import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  ViewChild,
  TemplateRef,
} from "@angular/core";
import BigNumber from "bignumber.js";
import * as moment from "moment";
import { CookieService } from "ngx-cookie-service";
import { AppComponent } from "../app.component";
import { AppConfig } from "../appconfig";
import { MetamaskErrorComponent } from "../components/metamaskError/metamask-error.component";

import { ContractService } from "../services/contract";
import { MatDialog } from "@angular/material/dialog";

@Component({
  selector: "app-auction-page",
  templateUrl: "./auction-page.component.html",
  styleUrls: ["./auction-page.component.scss"],
})
export class AuctionPageComponent implements OnDestroy {
  @ViewChild("successModal", {
    static: true,
  })
  successModal: TemplateRef<any>;

  @ViewChild("warningModal", {
    static: true,
  })
  warningModal: TemplateRef<any>;

  private warningDialog;

  public changeSort = true;

  public sortData = {
    id: true,
  } as any;

  public account;
  public tokensDecimals;
  private accountSubscribe;
  public onChangeAccount: EventEmitter<any> = new EventEmitter();

  public formsData: {
    auctionAmount?: string;
  } = {};

  public referalLink = "";
  public referalAddress = "";
  public addressCopy = false;
  public auctionPoolChecker = false;
  public currentAuctionDate = new Date();

  public dataSendForm = false;
  public showAuctions = false;
  public hasAuctionList = false;
  public newAuctionDay = false;
  public auctionTimer = "";
  public checker = undefined;

  public sendAuctionProgress: boolean;
  public auctionInfo: any;
  public auctionsList: any[];

  public poolInfo: any = {
    axn: 0,
    eth: 0,
  };

  public auctions: any;
  public auctionsIntervals: [];

  public currentSort: any = {};

  private settings: any;

  constructor(
    private contractService: ContractService,
    private cookieService: CookieService,
    private ngZone: NgZone,
    private appComponent: AppComponent,
    private config: AppConfig,
    private dialog: MatDialog
  ) {
    this.referalAddress = this.cookieService.get("ref");
    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (!account || account.balances) {
          this.ngZone.run(() => {
            this.account = account;
            window.dispatchEvent(new Event("resize"));
            if (account) {
              this.getAuctions();
              this.onChangeAmount();
              this.onChangeAccount.emit();

              this.contractService.getAuctionInfo().then((result) => {
                this.auctionInfo = result;
                window.dispatchEvent(new Event("resize"));
              });

              this.getUserAuctions();

              this.contractService.getAuctionPool().then((info) => {
                this.poolInfo = info;
                this.getAuctionPool();
                this.auctionPoolChecker = true;
              });
            }
          });
        }
      });

    this.tokensDecimals = this.contractService.getCoinsDecimals();
    this.settings = config.getConfig();
  }

  ngOnDestroy() {
    this.auctionPoolChecker = false;
    this.accountSubscribe.unsubscribe();
  }

  public scanDate(date) {
    const a1 = moment(new Date());
    const b1 = moment(date);

    if (Number(a1.format("D")) === Number(b1.format("D"))) {
      a1.add(1, "day");
    }

    // const b1 = moment().add(1, "days");
    // b1.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

    const check = a1.diff(b1);

    if (check < 0) {
      console.log(check);

      // console.log(a1.format("DD MM YYYY HH:mm:ss"))
      // console.log(b1.format("DD MM YYYY HH:mm:ss"))
      this.newAuctionDay = true;
    }

    this.setNewDayTimer();

    this.auctionTimer = moment
      .utc(
        moment(b1, "DD/MM/YYYY HH:mm:ss").diff(
          moment(a1, "DD/MM/YYYY HH:mm:ss")
        )
      )
      .format("HH:mm:ss");
  }

  public setNewDayTimer(date?) {
    if (date) {
      this.currentAuctionDate = date;
    }

    if (!this.newAuctionDay) {
      this.checker = setTimeout(() => {
        if (this.checker) {
          this.scanDate(this.currentAuctionDate);
        }
      }, 1000);
    } else {
      this.checker = undefined;
      this.getAuctions();
    }
  }

  public getAuctions() {
    this.contractService.getAuctions().then((res) => {
      this.auctions = res;

      this.auctions.map((auction) => {
        if (auction.time.state === "progress") {
          this.setNewDayTimer(auction.time.date);
          this.newAuctionDay = false;
        }
      });

      this.showAuctions = true;
    });
  }

  public getUserAuctions() {
    this.contractService.getUserAuctions().then((auctions) => {
      const auctions1 = auctions;

      auctions1.sort((a, b) =>
        new Date(a.start_date).getDate() < new Date(b.start_date).getDate()
          ? 1
          : -1
      );

      this.hasAuctionList = auctions1.length !== 0;
      this.auctionsList = auctions1;

      this.referalLink = "";
    });
  }

  public resetRef() {
    this.referalAddress = "";
    this.cookieService.set("ref", "");
  }

  public onChangeAmount() {
    this.dataSendForm =
      Number(this.formsData.auctionAmount) <= 0 ||
      this.formsData.auctionAmount === undefined
        ? false
        : true;

    if (
      this.formsData.auctionAmount >
      this.account.balances.ETH.shortBigNumber.toString()
    ) {
      this.formsData.auctionAmount = this.account.balances.ETH.shortBigNumber.toString();
    }

    this.dataSendForm =
      new BigNumber(this.formsData.auctionAmount).toNumber() <= 0 ||
      this.formsData.auctionAmount === undefined
        ? false
        : true;

    if (
      Number(this.formsData.auctionAmount) >
      Number(this.account.balances.ETH.wei)
    ) {
      this.dataSendForm = false;
    }

    if (this.formsData.auctionAmount === "") {
      this.dataSendForm = false;
    }

    if (this.formsData.auctionAmount) {
      if (this.formsData.auctionAmount.indexOf("+") !== -1) {
        this.dataSendForm = false;
      }
    }
  }

  private getAuctionPool() {
    setTimeout(() => {
      this.contractService.getAuctionPool().then((info: any) => {
        // console.log(info);
        if (info.axnToEth.toNumber() === 0) {
          info.axnToEth = this.poolInfo.axnToEth;
        }

        this.poolInfo = info;

        if (this.auctionPoolChecker) {
          this.getAuctionPool();
        }
      });
    }, this.settings.settings.checkerAuctionPool);
  }

  public successLowProfit() {
    this.warningDialog.close();
    this.sendETHToAuction(true);
  }

  public sendETHToAuction(withoutWarning?) {
    if (!withoutWarning) {
      const myTokens = new BigNumber(this.poolInfo.uniswapMiddlePrice)
        .times(this.formsData.auctionAmount)
        .div(new BigNumber(10).pow(this.tokensDecimals.ETH))
        .dp(0);
      if (myTokens.isZero()) {
        this.warningDialog = this.dialog.open(this.warningModal, {});
        return;
      }
    }

    this.sendAuctionProgress = true;

    const callMethod =
      this.formsData.auctionAmount === this.account.balances.ETH.wei
        ? "sendMaxETHToAuction"
        : "sendETHToAuction";

    this.contractService[callMethod](
      this.formsData.auctionAmount,
      this.cookieService.get("ref")
    )
      .then(
        ({ transactionHash }) => {
          this.contractService.updateETHBalance(true).then(() => {
            this.formsData.auctionAmount = undefined;
          });
        },
        (err) => {
          if (err.msg) {
            this.dialog.open(MetamaskErrorComponent, {
              width: "400px",
              data: {
                msg: err.msg,
              },
            });
          }
        }
      )
      .finally(() => {
        this.sendAuctionProgress = false;
      });
  }

  public generateRefLink() {
    this.referalLink =
      window.location.origin + "/auction?ref=" + this.account.address;
  }

  public onCopied() {
    this.addressCopy = true;

    setTimeout(() => {
      this.addressCopy = false;
    }, 2500);
  }

  public auctionWithdraw(auction) {
    auction.withdrawProgress = true;
    this.contractService
      .withdrawFromAuction(auction.auctionId)
      .then(() => {
        this.contractService.loadAccountInfo();
        auction.status = "complete";
        this.getUserAuctions();
      })
      .finally(() => {
        auction.withdrawProgress = false;
      });
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  // private applySort() {
  //   if (this.currentSort.field) {
  //     this.auctionsList.sort((a, b) => {
  //       let aValue = a[this.currentSort.field];
  //       let bValue = b[this.currentSort.field];
  //       switch (this.currentSort.field) {
  //         case "start":
  //           aValue = aValue.getTime();
  //           bValue = bValue.getTime();
  //           break;
  //         case "token":
  //         case "eth":
  //         case "accountTokenBalance":
  //           aValue = aValue.toNumber();
  //           bValue = bValue.toNumber();
  //           break;
  //       }

  //       return aValue > bValue
  //         ? this.currentSort.ask
  //           ? 1
  //           : -1
  //         : aValue < bValue
  //         ? this.currentSort.ask
  //           ? -1
  //           : 1
  //         : 1;
  //     });
  //   } else {
  //     this.auctionsList.sort((a, b) => {
  //       return Number(a.auctionId) > Number(b.auctionId) ? 1 : -1;
  //     });
  //   }
  // }

  // public async sortAuctions(type: string, tdate?: string) {
  //   this.sortData[type] && this.changeSort
  //     ? (this.changeSort = false)
  //     : (this.changeSort = true);
  //   Object.keys(this.sortData).forEach((v) => (this.sortData[v] = v === type));

  //   this.auctions.sort((auctionsList1, auctionsList2) => {
  //     let sortauctionsList1: any;
  //     let sortauctionsList2: any;

  //     if (tdate) {
  //       sortauctionsList1 =
  //         tdate === "date"
  //           ? new Date(auctionsList1[type]).getDate()
  //           : new Date(auctionsList1[type]).getTime();
  //       sortauctionsList2 =
  //         tdate === "date"
  //           ? new Date(auctionsList2[type]).getDate()
  //           : new Date(auctionsList2[type]).getTime();
  //     } else {
  //       sortauctionsList1 = auctionsList1[type];
  //       sortauctionsList2 = auctionsList2[type];
  //     }

  //     if (this.changeSort) {
  //       return sortauctionsList1 > sortauctionsList2 ? 1 : -1;
  //     } else {
  //       return sortauctionsList1 < sortauctionsList2 ? 1 : -1;
  //     }
  //   });
  // }

  // public sortAuctions(field) {
  //   const currentUseField = this.currentSort.field;

  //   if (currentUseField !== field) {
  //     this.currentSort.field = field;
  //     this.currentSort.ask = false;
  //   } else {
  //     if (!this.currentSort.ask) {
  //       this.currentSort.ask = true;
  //     } else {
  //       this.currentSort.field = undefined;
  //     }
  //   }
  //   this.applySort();
  // }
}
