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
import { TransactionSuccessModalComponent } from "../components/transactionSuccessModal/transaction-success-modal.component";

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

            this.updatePools().then(pools => {
              // Determine which pool to load
              this.activatedRoute.params.subscribe(params => {
                if (params['pool'])
                  this.processParams(params['pool'])
                else
                  this.setCurrentPool(pools[0])
              });
            }); 
          }
        });
      }
    });
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }

  public async getPoolDecimals(address: string) {
    this.tokensDecimals = await this.contractService.getDecimals(address);
  }

  public async updatePools() {
    const POOLS = await this.contractService.getPools();
    if (POOLS.length > 0)
      this.pools = POOLS;
    return POOLS;
  }

  public openSuccessModal(txID: string) {
    this.dialog.open(TransactionSuccessModalComponent, {
      width: "400px",
      data: txID,
    });
  }

  public openErrorModal(message: string) {
    this.dialog.open(MetamaskErrorComponent, {
      width: "400px",
      data: { msg: message },
    });
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  public openUniswapPoolInfo(addr = this.currentPool.address) {
    window.open(`https://info.uniswap.org/pair/${addr}`, "_blank")
  }

  public openCreatePoolModal() {
    this.createPoolData.ref = this.dialog.open(this.createPoolModal, {});
  }

  public async updatePoolBalances() {
    this.userTokenBalance = await this.contractService.getTokenBalance(this.currentPool.address, this.account.address);
  }

  public async onCreatePoolAddressChanged() {
    const address = this.createPoolData.tokenAddress;

    if (address) {
      try {
        const SYMBOLS = await this.contractService.getPoolTokens(address.trim())
        if (SYMBOLS) {
          this.createPoolData.base = SYMBOLS.base;
          this.createPoolData.market = SYMBOLS.market;
        }
      } catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
    }
  }

  public setCurrentPool(pool) {
    this.switchingLoading = pool.address;

    // TODO: remove setTimeout when implemented. 
    // Simulate the loading/network requests to get balance, stats & decimals
    setTimeout(async () => {
      try {
        this.currentPool = pool;
        this.currentPoolStats = await this.contractService.getUserPoolBalance(this.account.address);
        await this.updatePoolBalances();
        await this.getPoolDecimals(pool.address);
      }
      catch (err) { console.log(err) }
      finally { this.switchingLoading = "" }
    }, 500)
  }

  // Process URL params to hel pwith direct linking
  public processParams(params) {
    try {
      const BASE = params.split("-")[0].toUpperCase()
      const MARKET = params.split("-")[1].toUpperCase()
      const POOL_FOUND = this.pools.find(p => p.base === BASE && p.market === MARKET)

      if (POOL_FOUND)
        this.setCurrentPool(POOL_FOUND)
      else {
        const FALLBACK_POOL = this.pools[0]
        this.setCurrentPool(FALLBACK_POOL)
        this.openErrorModal(`${BASE}-${MARKET} pool not found. Falling back to ${FALLBACK_POOL.base}-${FALLBACK_POOL.market}.`)

        // Cosmetic: Since pool doesn't exist, take it out of the url that the user tried
        // Doing it this way does not refresh the current page.
        window.history.replaceState({}, document.title, "/mining");
      }
    } catch (err) {
      console.log("Invalid params, loading default pool...")
      this.setCurrentPool(this.pools[0])
    }
  }

  public async deposit() {
    if (this.depositAmount > 0) {
      try {
        this.currentPool.depositProgress = true;
        await this.contractService.depositLPTokens(this.depositAmount);
        this.updatePoolBalances()
        this.updatePools();
        // this.openSuccessModal("txID");
      }
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally {
        this.currentPool.depositProgress = false;
      }
    }
  }

  public async withdraw(type: string) { 
    let progressIndicatorVariable: string;

    if (type === "LP") progressIndicatorVariable = "withdrawLPProgress";
    else if (type === "REWARDS") progressIndicatorVariable = "withdrawRewardsProgress";
    else if (type === "ALL") progressIndicatorVariable = "withdrawAllProgress";

    try {
      this.currentPool[progressIndicatorVariable] = true;
      await this.contractService.withdraw(type);
      this.updatePoolBalances();
      this.updatePools();
      //this.openSuccessModal("txID");
    } 
    catch (err) {
      if (err.message)
        this.openErrorModal(err.message)
    } 
    finally {
      this.currentPool[progressIndicatorVariable] = false;
    }
  }

  // ONLY MANAGERS
  public async createPool() {
    if (!this.createPoolData.rewardPool || !this.createPoolData.tokenAddress || !this.createPoolData.startBlock || !this.createPoolData.endBlock) {
      this.openErrorModal("Missing information. All fields must be filled.")
      return;
    }

    this.createPoolData.progressIndicator = true;

    const rewards = this.createPoolData.rewardPool;
    const address = this.createPoolData.tokenAddress;
    const startBlock = this.createPoolData.startBlock;
    const endBlock = this.createPoolData.endBlock;

    try {
      await this.contractService.createPool(address, rewards, startBlock, endBlock)

      this.createPoolData.ref.close();
      this.createPoolData.progressIndicator = false;
      this.createPoolData = {};
      this.updatePools();
      // this.openSuccessModal("txID");
    }
    catch (err) {
      if (err.message)
        this.openErrorModal(err.message)
    }
  }
}
