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

import { MiningContractService } from "../services/mining-contract";
import { MatDialog } from "@angular/material/dialog";

@Component({
  selector: "app-mining-page",
  templateUrl: "./mining-page.component.html",
  styleUrls: ["./mining-page.component.scss"],
})
export class MiningPageComponent implements OnDestroy {
  public account;
  public tokensDecimals;
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  
  public pools: any[];
  public currentPool: any = {};
  public formData: any = {
    amount: 0
  }

  private accountSubscribe;
  private settings: any = {};

  constructor(
    public contractService: MiningContractService,
    private cookieService: CookieService,
    private ngZone: NgZone,
    private appComponent: AppComponent,
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
              this.pools  = this.getPools();
              this.currentPool = this.pools[0];
            }
          });
        }
      });

    this.tokensDecimals = this.contractService.getCoinsDecimals();
    this.settings = config.getConfig();
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  // TODO: Get actual pools
  private getPools() {
    return [{
      address: "0xaadb00551312a3c2a8b46597a39ef1105afb2c08",
      base: "AXN",
      market: "ETH",

      stakedTokens: 5.123,
      rewardsEarned: 100000.1128423,

      isLive: true,
      depositProgress: false,
      withdrawLPProgress: false,
      withdrawAllProgress: false,
      withdrawRewardsProgress: false,
    }]
  }

  public depositLPTokens() {
    console.log(this.formData.amount)
    console.log(this.currentPool)

    this.currentPool.depositProgress = true;
    setTimeout(() => {
      this.currentPool.depositProgress = false;
    }, 2000)
  }

  public withdrawLP() {
    console.log("Withdraw LP")
    this.currentPool.withdrawLPProgress = true;
    setTimeout(() => {
      this.currentPool.withdrawLPProgress = false;
    }, 2000)
  }

  public withdrawRewards() {
    console.log("Withdraw Reward")
    this.currentPool.withdrawRewardsProgress = true;
    setTimeout(() => {
      this.currentPool.withdrawRewardsProgress = false;
    }, 2000)
  }

  public withdrawAll() {
    console.log("Withdraw All")
    this.currentPool.withdrawAllProgress = true;
    setTimeout(() => {
      this.currentPool.withdrawAllProgress = false;
    }, 2000)
  }
}
