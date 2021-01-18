import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  ViewChild,
  TemplateRef,
} from "@angular/core";
import BigNumber from "bignumber.js";
import { AppComponent } from "../app.component";
import { MatDialog } from "@angular/material/dialog";
import { MiningContractService } from "../services/mining-contract";
import { MetamaskErrorComponent } from "../components/metamaskError/metamask-error.component";

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
  public userTokenBalance: any = {};
  public currentPool: any = {};
  public currentPoolStats: any = {};
  public depositAmount = 0;
  private accountSubscribe;

  constructor(
    public contractService: MiningContractService,
    private ngZone: NgZone,
    private appComponent: AppComponent,
    private dialog: MatDialog
  ) {
    this.accountSubscribe = this.contractService.accountSubscribe().subscribe((account: any) => {
      if (!account || account.balances) {
        this.ngZone.run(() => {
          this.account = account;
          window.dispatchEvent(new Event("resize"));

          if (account) {
            this.onChangeAccount.emit();
            this.pools  = this.getPools();
            this.currentPool = this.pools[0];
            this.currentPoolStats = this.getPoolStats(account.address);
            this.contractService.getDecimals(this.currentPool.address).then(decimals => this.tokensDecimals = decimals )
            this.updatePoolBalances();    
          }
        });
      }
    });
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }

  // TODO: Get actual pools
  private getPools() {
    return [{
      address: "0xaadb00551312a3c2a8b46597a39ef1105afb2c08",
      base: "AXN",
      market: "ETH",
      isLive: true
    }]
  }

  // TODO: Get actual account data
  private getPoolStats(address) {
    return {
      stakedTokens: new BigNumber(0),
      rewardsEarned: new BigNumber(0)
    }
  }


  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  public async depositLPTokens() {
    if (this.depositAmount > 0) {
      const methodName = "deposit";

      try {
        this.currentPool.depositProgress = true;
        await this.contractService[methodName](this.depositAmount);
        this.updatePoolBalances()
        this.getPools();
      } 
      catch (err) {
        if (err.message) {
          this.dialog.open(MetamaskErrorComponent, {
            width: "400px",
            data: { msg: err.message },
          });
        }
      } 
      finally {
        this.currentPool.depositProgress = false;
      }
    }
  }

  public addMax() {
    this.depositAmount = this.userTokenBalance.wei;
  }

  public async updatePoolBalances() {
    this.userTokenBalance = await this.contractService.getTokenBalance(this.currentPool.address, this.account.address);
  }

  public async withdraw(type) { 
    let progressIndicatorVariable: string;

    if (type === "LP") progressIndicatorVariable = "withdrawLPProgress";
    else if (type === "REWARDS") progressIndicatorVariable = "withdrawRewardsProgress";
    else if (type === "ALL") progressIndicatorVariable = "withdrawAllProgress";

    try {
      this.currentPool[progressIndicatorVariable] = true;
      await this.contractService.withdraw(type);

      // Update info after success
      this.updatePoolBalances();
      this.getPools();
    } 
    catch (err) {
      if (err.message) {
        this.dialog.open(MetamaskErrorComponent, {
          width: "400px",
          data: { msg: err.message },
        });
      }
    } 
    finally {
      this.currentPool[progressIndicatorVariable] = false;
    }
  }
}
