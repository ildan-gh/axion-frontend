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
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-mining-page",
  templateUrl: "./mining-page.component.html",
  styleUrls: ["./mining-page.component.scss"],
})
export class MiningPageComponent implements OnDestroy {
  @ViewChild("createPoolModal", {
    static: true,
  })
  createPoolModal: TemplateRef<any>;

  public account;
  public tokensDecimals;
  public switchingLoading;
  public createPoolData: any = {}
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  
  public pools: any[];
  public userTokenBalance: any = {};
  public currentPool: any;
  public currentPoolStats: any = {};
  public depositAmount = 0;
  private accountSubscribe;

  constructor(
    public contractService: MiningContractService,
    private ngZone: NgZone,
    private appComponent: AppComponent,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute
  ) {
    this.accountSubscribe = this.contractService.accountSubscribe().subscribe((account: any) => {
      if (!account || account.balances) {
        this.ngZone.run(() => {
          this.account = account;
          window.dispatchEvent(new Event("resize"));

          if (account) {
            this.onChangeAccount.emit();

            const POOLS = this.getPools(); 
            if(POOLS.length > 0) {
              this.pools = POOLS;

              // Determine which pool to load
              this.activatedRoute.params.subscribe(params => {
                const pool = params['pool'];
                if (pool)
                  this.processParams(pool)
                else 
                  this.setCurrentPool(this.pools[0])
              });
            }
          }
        });
      }
    });
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }

  // Process URL params to hel pwith direct linking
  private processParams(params) {
    try {
      const BASE = params.split("-")[0].toUpperCase()
      const MARKET = params.split("-")[1].toUpperCase()
      const POOL_FOUND = this.pools.find(p => p.base === BASE && p.market === MARKET)

      if (POOL_FOUND)
        this.setCurrentPool(POOL_FOUND)
      else
        this.setCurrentPool(this.pools[0])
    } catch (err) {
      console.log("Invalid params, loading default pool...")
      this.setCurrentPool(this.pools[0])
    }
  }

  // TODO: Get actual pools
  private getPools() {
    return [
      {
        address: "0xaadb00551312a3c2a8b46597a39ef1105afb2c08",
        base: "AXN",
        market: "ETH",

        startBlock: 11686417,
        endBlock: 11752227,
        rewardPool: 5000000000000000000000000000,

        isLive: true
      },
      { // EXAMPLE
        address: "0xd7f7c34dd455efafce52d8845b2646c790db0cdd",
        base: "HEX",
        market: "AXN",

        startBlock: 11686417,
        endBlock: 11752227,
        rewardPool: 1000000000000000000000000000,

        isLive: false
      }
    ]
  }

  // TODO: Get actual account data
  private getPoolStats(address) {
    return {
      stakedTokens: new BigNumber(0),
      rewardsEarned: new BigNumber(0)
    }
  }

  private async getPoolDecimals(address) {
    this.tokensDecimals = await this.contractService.getDecimals(address);
  }

  public setCurrentPool(pool) {
    this.switchingLoading = pool.address;

    // Simulate the loading/network requests to get balance, stats & decimals
    setTimeout(async () => {
      try {
        this.currentPool = pool;
        this.currentPoolStats = this.getPoolStats(this.account.address);
        await this.updatePoolBalances();
        await this.getPoolDecimals(pool.address);
      }
      catch (err) { console.log(err) }
      finally { this.switchingLoading = "" }
    }, 500)
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  public openUniswapPoolInfo() {
    window.open(`https://info.uniswap.org/pair/${this.currentPool.address}`, "_blank")
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

  public openCreatePoolModal() {
    this.createPoolData.ref = this.dialog.open(this.createPoolModal, {});
  }

  public createPool() {
    if (
      !this.createPoolData.rewardAmount ||
      !this.createPoolData.tokenAddress || 
      !this.createPoolData.startBlock ||
      !this.createPoolData.endBlock ||
      !this.createPoolData.tokenSymbol ||
      !this.createPoolData.tokenMarket
    ) {
      this.dialog.open(MetamaskErrorComponent, {
        width: "400px",
        data: { msg: "Missing information. All fields must be filled." },
      });
      return;
    }
    
    this.createPoolData.progressIndicator = true;

    setTimeout(() => {
      const base = this.createPoolData.tokenSymbol.toUpperCase();
      const market = this.createPoolData.tokenMarket.toUpperCase();

      this.createPoolData.progressIndicator = false;
      console.log(this.createPoolData)
    }, 2000)
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
