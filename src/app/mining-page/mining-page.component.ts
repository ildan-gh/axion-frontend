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
import { Mine } from '../services/mining-contract';

@Component({
  selector: "app-mining-page",
  templateUrl: "./mining-page.component.html",
  styleUrls: ["./mining-page.component.scss"],
})
export class MiningPageComponent implements OnDestroy {
  @ViewChild("createMineModal", {
    static: true,
  })
  createMineModal: TemplateRef<any>;
  private accountSubscribe;
  public tokensDecimals = 18;  // Always 18 UNI-V2 pairs

  public account;
  public switchingLoading;
  public mines: Mine[];
  public currentMine: Mine;
  public createMineData: any = {}
  public minerBalance: any = {};
  public currentMineStats: any = {};
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  public formData = {
    depositAmount: "",
    withdrawLPAmount: ""
  }

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

            this.updateMines().then(mines => {
              // Determine which pool to load
              this.activatedRoute.params.subscribe(params => {
                if (params['mine'])
                  this.processParams(params['mine'])
                else if (mines.length > 0)
                  this.setCurrentMine(mines[0])
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

  /** Cosmetic: Used when mine doesn't exist. Takes mine param out of the url.
      Doing it this way does not refresh the current page.*/
  private fixURL(){
    window.history.replaceState({}, document.title, "/mining");
  }

  public async updateMines() {
    const MINES = await this.contractService.getMines();
    this.mines = MINES;
    return MINES;
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

  public openUniswapPoolInfo(addr = this.currentMine.lpToken) {
    window.open(`https://info.uniswap.org/pair/${addr}`, "_blank")
  }

  public openCreateMineModal() {
    this.createMineData.ref = this.dialog.open(this.createMineModal, {});
  }

  public async updateMinerBalance() {
    this.minerBalance.lpDeposit = await this.contractService.getMinerPoolBalance(this.currentMine.lpToken);
    this.minerBalance.pendingReward = await this.contractService.getPendingReward(this.currentMine.lpToken);
  }

  public async onCreateMineAddressChanged() {
    const address = this.createMineData.tokenAddress;

    if (address) {
      try {
        const SYMBOLS = await this.contractService.getPoolTokens(address.trim())
        if (SYMBOLS) {
          this.createMineData.base = SYMBOLS.base;
          this.createMineData.market = SYMBOLS.market;
        }
      } catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
    }
  }

  public async setCurrentMine(mine) {
    this.switchingLoading = mine.lpToken;

    try {
      this.currentMine = mine;
      this.currentMineStats = await this.contractService.getMinerPoolBalance(this.currentMine.lpToken);
      await this.updateMinerBalance();
    }
    catch (err) { console.log(err) }
    finally { this.switchingLoading = "" }
  }

  // Process mine pair found in URL parameter
  public processParams(pair: string) {
    try {
      if (this.mines.length > 0) {
        const BASE = pair.split("-")[0].toUpperCase()
        const MARKET = pair.split("-")[1].toUpperCase()
        const MINE_FOUND = this.mines.find(p => p["base"] === BASE && p["market"] === MARKET)

        if (MINE_FOUND) {
          this.setCurrentMine(MINE_FOUND)
        }
        else {
          const FALLBACK_POOL = this.mines[0]
          this.setCurrentMine(FALLBACK_POOL)
          this.openErrorModal(`${BASE}-${MARKET} mine not found. Falling back to ${FALLBACK_POOL["base"]}-${FALLBACK_POOL["market"]}.`)
          this.fixURL();
        }
      } else {
        this.fixURL();
        this.openErrorModal(`There are currently no active mines. Please check back later!`)
      }
    } catch (err) {
      console.log("Invalid params, loading default mine...")
      this.setCurrentMine(this.mines[0])
    }
  }

  public async deposit() {
    if (+this.formData.depositAmount > 0) {
      try {
        this.currentMine["depositProgress"] = true;
        await this.contractService.depositLPTokens(this.currentMine.lpToken, this.formData.depositAmount);
        this.updateMinerBalance();
        this.updateMines();
      }
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally {
        this.currentMine["depositProgress"] = false;
      }
    }
  }

  public async withdraw(type: string) { 
    let progressIndicatorVariable: string;
    let withdrawalMethod: string;

    if (type === "LP") {
      withdrawalMethod = "withdrawLPTokens"
      progressIndicatorVariable = "withdrawLPProgress";
    }   
    else if (type === "REWARDS") {
      withdrawalMethod = "withdrawReward"
      progressIndicatorVariable = "withdrawRewardsProgress";
    }   
    else if (type === "ALL") {
      withdrawalMethod = "withdrawAll";
      progressIndicatorVariable = "withdrawAllProgress";
    } 

    try {
      this.currentMine[progressIndicatorVariable] = true;

      if (withdrawalMethod === "withdrawLPTokens")
        await this.contractService.withdrawLPTokens(this.currentMine.lpToken, "0"); // TODO: fix
      else
        await this.contractService[withdrawalMethod](this.currentMine.lpToken);

      this.updateMinerBalance();
      this.updateMines();
    } 
    catch (err) {
      if (err.message)
        this.openErrorModal(err.message)
    } 
    finally {
      this.currentMine[progressIndicatorVariable] = false;
    }
  }

  // ONLY MANAGERS
  public async createMine() {
    if (!this.createMineData.rewardPool || !this.createMineData.tokenAddress || !this.createMineData.startBlock || !this.createMineData.endBlock) {
      this.openErrorModal("Missing information. All fields must be filled.")
      return;
    }

    this.createMineData.progressIndicator = true;

    const rewards = this.createMineData.rewardPool;
    const address = this.createMineData.tokenAddress;
    const startBlock = this.createMineData.startBlock;
    const endBlock = this.createMineData.endBlock;
    const blocks = endBlock - startBlock;
    const blockReward = rewards / blocks;
    try {
      await this.contractService.createMine(address, rewards, new BigNumber(blockReward), startBlock)
      this.createMineData.ref.close();
      this.createMineData = {};
      this.updateMines();
    }
    catch (err) {
      if (err.message)
        this.openErrorModal(err.message)
    }
  }
}
