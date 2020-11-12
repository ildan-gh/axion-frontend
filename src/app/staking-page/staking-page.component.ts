import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { ContractService, stakingMaxDays } from "../services/contract";
import BigNumber from "bignumber.js";
import { AppConfig } from "../appconfig";
import { MatDialog } from "@angular/material/dialog";

interface StakingInfoInterface {
  ShareRate: number;
  StepsFromStart: number;
  closestYearShares?: string;
  closestPoolAmount?: string;
}

const FULL_PERIOD = 700;
const AVAILABLE_DAYS_AFTER_END = 14;

@Component({
  selector: "app-staking-page",
  templateUrl: "./staking-page.component.html",
  styleUrls: ["./staking-page.component.scss"],
})
export class StakingPageComponent implements OnDestroy {
  public account;
  public tableInfo;
  public tokensDecimals;
  public depositMaxDays = 5555;
  private accountSubscribe;
  public shareRate = 0;
  public hasBigPayDay = false;
  public stakeDays: any;
  public startDay = new Date();
  public share: any = {};
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  public formsData: {
    depositAmount?: string;
    depositDays?: number;
  } = {};
  public depositTokensProgress: boolean;
  public depositsLists: {
    opened?: any;
    closed?: any;
  };
  @ViewChild("depositForm", { static: false }) depositForm;

  @ViewChild("warningModal", {
    static: true,
  })
  warningModal: TemplateRef<any>;

  public stakingContractInfo: StakingInfoInterface = {
    ShareRate: 0,
    StepsFromStart: 0,
    closestYearShares: "0",
    closestPoolAmount: "0",
  };

  private stakingInfoChecker = false;
  private bpdInfoChecker = false;

  public currentSort: {
    opened: any;
    closed: any;
  } = {
    opened: {},
    closed: {},
  };

  public bpd: any = [];

  private settingsData: any;
  private dayEndSubscriber;

  constructor(
    private contractService: ContractService,
    private ngZone: NgZone,
    private config: AppConfig,
    private dialog: MatDialog
  ) {
    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (!account || account.balances) {
          this.ngZone.run(() => {
            this.account = account;
            window.dispatchEvent(new Event("resize"));
            if (account) {
              this.onChangeAccount.emit();
              this.depositList();
              this.contractService
                .getStakingContractInfo()
                .then((data: StakingInfoInterface) => {
                  this.stakingContractInfo = data;
                  window.dispatchEvent(new Event("resize"));
                });

              this.contractService.geBPDInfo().then((result) => {
                this.bpd = result;
                // console.log("BPD data", this.bpd);
                this.tableInfo = result[4].show;
                this.getBPDInfo();
                this.bpdInfoChecker = true;
              });
            }
          });
        }
      });

    this.tokensDecimals = this.contractService.getCoinsDecimals();
    this.settingsData = this.config.getConfig();
    this.dayEndSubscriber = this.contractService.onDayEnd().subscribe(() => {
      this.depositList();
    });
  }

  public getStakingInfo() {
    setTimeout(() => {
      this.contractService
        .getStakingContractInfo()
        .then((data: StakingInfoInterface) => {
          this.stakingContractInfo = data;
          // console.log("staking contract info", this.stakingContractInfo);
          if (this.stakingInfoChecker && this.account) {
            this.getStakingInfo();
          }
        });
    }, this.settingsData.settings.checkerStakingInfo);
  }

  public getBPDInfo() {
    setTimeout(() => {
      this.contractService.geBPDInfo().then((result) => {
        this.bpd = result;
        this.tableInfo = result[4].show;
        if (this.bpdInfoChecker && this.account) {
          this.getBPDInfo();
        }
      });
    }, this.settingsData.settings.checkerBPD);
  }

  public depositList() {
    this.contractService.getAccountStakes().then((res) => {
      this.depositsLists = res;
      // console.log("user deposits lists", this.depositsLists);

      this.applySort("opened");
      this.applySort("closed");
      window.dispatchEvent(new Event("resize"));
      this.getStakingInfo();
      this.stakingInfoChecker = true;
    });
  }

  public openDeposit() {
    this.depositTokensProgress = true;
    this.contractService
      .depositHEX2X(this.formsData.depositAmount, this.formsData.depositDays)
      .then((r) => {
        this.contractService.updateHEX2XBalance(true).then(() => {
          this.depositTokensProgress = false;
          this.shareRate = 0;
        });
        this.formsData = {};
      })
      .catch(() => {
        this.depositTokensProgress = false;
      });
  }

  get bonusLongerPays() {
    const currentValue = new BigNumber(this.formsData.depositAmount || 0);
    return currentValue
      .times((this.formsData.depositDays || 1) - 1)
      .div(stakingMaxDays);
  }

  get userShares() {
    const divDecimals = Math.pow(10, this.tokensDecimals.HEX2X);
    return new BigNumber(this.formsData.depositAmount || 0)
      .div(divDecimals)
      .times(this.bonusLongerPays.div(divDecimals).plus(1))
      .div(this.stakingContractInfo.ShareRate || 1)
      .times(divDecimals);
  }

  get depositDaysInvalid() {
    return (this.formsData.depositDays || 0) > this.depositMaxDays;
  }

  public onChangeAmount() {
    const divDecimals = Math.pow(10, this.tokensDecimals.HEX2X);

    const stareRate = new BigNumber(this.stakingContractInfo.ShareRate || 0)
      .div(divDecimals)
      .toString();

    const amount = new BigNumber(this.formsData.depositAmount || 0)
      .div(divDecimals)
      .toString();

    const rate =
      (Number(amount) *
        (1 + (this.formsData.depositDays - 1) / stakingMaxDays)) /
      Number(stareRate);

    const shareRate = new BigNumber(rate);

    if (this.formsData.depositDays) {
      this.shareRate = isNaN(shareRate.toNumber())
        ? (new BigNumber(0) as any)
        : (new BigNumber(rate) as any);
    }

    this.stakeDays =
      Date.now() +
      this.formsData.depositDays *
        this.contractService.settingsApp.settings.time.seconds *
        1000;

    const sharefull = new BigNumber(amount).div(
      new BigNumber(this.stakingContractInfo.ShareRate).div(
        Math.pow(10, this.tokensDecimals.HEX2X)
      )
    );

    this.share.short = parseFloat(sharefull.toFixed(4).toString());

    this.share.full = !isNaN(sharefull.toNumber()) ? sharefull : 0;
  }

  public getProgress(deposit) {
    if (deposit.oldUpdate && new Date().getTime() - deposit.oldUpdate < 5000) {
      return deposit.progress;
    }
    deposit.oldUpdate = new Date().getTime();
    const fullAge = deposit.end.getTime() - deposit.start.getTime();
    const backAge = new Date().getTime() - deposit.start.getTime();
    deposit.progress = Math.min(Math.round(backAge / (fullAge / 100)), 100);
    return deposit.progress;
  }

  private applySort(table) {
    const currentTableState = this.currentSort[table];
    if (currentTableState.field) {
      this.depositsLists[table].sort((a, b) => {
        let aValue = a[currentTableState.field];
        let bValue = b[currentTableState.field];

        switch (currentTableState.field) {
          case "start":
          case "end":
            aValue = aValue.getTime();
            bValue = bValue.getTime();
            break;
          case "amount":
          case "shares":
            aValue = aValue.toNumber();
            bValue = bValue.toNumber();
            break;
        }

        return aValue > bValue
          ? currentTableState.ask
            ? 1
            : -1
          : aValue < bValue
          ? currentTableState.ask
            ? -1
            : 1
          : 1;
      });
    } else {
      this.depositsLists[table].sort((a, b) => {
        return Number(a.sessionId) < Number(b.sessionId) ? 1 : -1;
      });
    }
  }

  public sortDeposits(table, field) {
    const currentTableState = this.currentSort[table];
    const currentUseField = currentTableState.field;

    if (currentUseField !== field) {
      currentTableState.field = field;
      currentTableState.ask = false;
    } else {
      if (!currentTableState.ask) {
        currentTableState.ask = true;
      } else {
        currentTableState.field = undefined;
      }
    }
    this.applySort(table);
  }

  public successWithPenalty() {
    this.confirmWithdrawData.openedWarning.close();
    this.depositWithdraw(this.confirmWithdrawData.deposit, true);
  }

  public confirmWithdrawData;

  public depositWithdraw(deposit, withoutConfirm?) {
    if (!withoutConfirm) {
      if (!deposit.penalty.isZero()) {
        const openedWarning = this.dialog.open(this.warningModal, {});
        const oneDayInSeconds = this.contractService.getMSecondsInDay();
        const nowTS = Date.now();
        const endTS = Date.parse(deposit.end);
        const endTwoWeeks = endTS + oneDayInSeconds * AVAILABLE_DAYS_AFTER_END;
        const late = nowTS < endTS ? "Early" : nowTS > endTwoWeeks ? "Late" : "Normal";
        this.confirmWithdrawData = {
          deposit,
          openedWarning,
          penalty: deposit.penalty,
          late,
          payOutAmount: deposit.forWithdraw,
        };
        return;
      }
    }
    deposit.withdrawProgress = true;

    this.contractService
      .unstake(deposit.sessionId)
      .then((res) => {
        // console.log("deposit unstake step 1", res);
        this.contractService.getSessionStats(deposit.sessionId).then((res2) => {
          // console.log("deposit unstake step 2", res2);

          if (res2 > 0) {
            this.contractService
              .stakingWithdraw(deposit.sessionId)
              .then((res3) => {
                // console.log("deposit unstake step 3", res3);
                this.contractService.updateHEX2XBalance(true);
                deposit.withdrawProgress = false;
              });
          } else {
            this.depositList();
          }
        });
      })
      .catch(() => {
        deposit.withdrawProgress = false;
      });
  }

  ngOnDestroy() {
    this.stakingInfoChecker = false;
    this.bpdInfoChecker = false;
    this.accountSubscribe.unsubscribe();
    this.dayEndSubscriber.unsubscribe();
  }
}
