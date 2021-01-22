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
import { Mine as BasicMine } from '../services/mining-contract';

interface Mine extends BasicMine {
  depositLPLoading?: boolean,
  withdrawLPLoading?: boolean,
  withdrawAllLoading?: boolean,
  withdrawRewardsLoading?: boolean,
}

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

  @ViewChild("withdrawLPModal", {
    static: true,
  })
  withdrawLPModal: TemplateRef<any>;

  private accountSubscribe;
  public tokensDecimals = 18;  // Always 18 UNI-V2 pairs

  public account;
  public switchingLoading;
  public mines: Mine[];
  public currentMine: Mine;

  public onChangeAccount: EventEmitter<any> = new EventEmitter();

  public createMineData = {
    base: "",
    market: "",
    endBlock: null,
    startBlock: null,
    tokenAddress: "",
    rewardAmount: "",
    progressIndicator: false,
    blockReward: new BigNumber(0),
    ref: null,
  }

  public formData = {
    depositLPAmount: "",
    withdrawLPAmount: "",
    ref: null
  }

  public minerBalance = {
    lpDeposit: new BigNumber(0),
    pendingReward: new BigNumber(0),
    lpAvailable: {
      wei: "0",
      bn: new BigNumber(0)
    }
  };

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
    const mines = await this.contractService.getMines();
    this.mines = mines;
    return mines;
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

  public openWithdrawLPModal() {
    this.formData.ref = this.dialog.open(this.withdrawLPModal, {});
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  public openUniswapPoolInfo(addr = this.currentMine.lpToken) {
    window.open(`https://info.uniswap.org/pair/${addr}`, "_blank")
  }

  public async openCreateMineModal() {
    this.createMineData.ref = this.dialog.open(this.createMineModal, {});
    try {
      this.createMineData.startBlock = (await this.contractService.getCurrentBlock()) + 50;
    } catch (err) { console.log(err) }
  }

  public async updateMinerBalance() {
    this.minerBalance.lpDeposit = await this.contractService.getMinerPoolBalance(this.currentMine.mineAddress);
    this.minerBalance.pendingReward = await this.contractService.getPendingReward(this.currentMine.mineAddress);
    this.minerBalance.lpAvailable = await this.contractService.getTokenBalance(this.currentMine.lpToken);
  }

  public async onCreateMineAddressChanged() {
    const address = this.createMineData.tokenAddress;

    if (address) {
      try {
        const symbols = await this.contractService.getPoolTokens(address.trim())
        if (symbols) {
          this.createMineData.base = symbols.base;
          this.createMineData.market = symbols.market;
        }
      } catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
    }
  }

  public onRewardAmountChanged() {
    if (this.createMineData.rewardAmount && this.createMineData.startBlock && this.createMineData.endBlock) {
      this.createMineData.blockReward = this.contractService.calculateBlockReward(
        this.createMineData.rewardAmount,
        this.createMineData.startBlock,
        this.createMineData.endBlock,
      )
    }
  }

  public async setCurrentMine(mine: Mine) {
    this.switchingLoading = mine.lpToken;

    try {
      this.currentMine = mine;
      await this.updateMinerBalance();
    }
    catch (err) { console.log(err) }
    finally { this.switchingLoading = "" }
  }

  // Process mine pair address found in URL parameter
  public processParams(lpToken: string) {
    if (this.mines.length > 0) {
      const mineFound = this.mines.find(p => p.lpToken === lpToken)

      if (mineFound) {
        this.setCurrentMine(mineFound)
      }
      else {
        const fallbackPool = this.mines[0]
        this.fixURL();
        this.setCurrentMine(fallbackPool)
        this.openErrorModal(`Mine not found. Falling back to ${fallbackPool.base}-${fallbackPool.market}.`)
      }
    } else {
      this.fixURL();
      this.openErrorModal(`There are currently no active mines. Please check back later!`)
    }
  }

  public async deposit() {
    if (+this.formData.depositLPAmount > 0) {
      try {
        this.currentMine.depositLPLoading = true;
        await this.contractService.depositLPTokens(this.currentMine.lpToken, this.formData.depositLPAmount);
        this.updateMinerBalance();
        this.updateMines();
      }
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally {
        this.currentMine.depositLPLoading = false;
      }
    }
  }

  public async withdrawRewards(){
    if(!this.minerBalance.pendingReward.isZero()) {
      this.currentMine.withdrawRewardsLoading = true;
      
      try {
        await this.contractService.withdrawReward(this.currentMine.lpToken);
        this.updateMines();
        this.updateMinerBalance();
      } 
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally { 
        this.currentMine.withdrawRewardsLoading = false 
      }
    }
  }

  public async withdrawAll() { 
    if (!this.minerBalance.pendingReward.isZero() && !this.minerBalance.lpDeposit.isZero()) {
      this.currentMine.withdrawAllLoading = true;

      try {
        await this.contractService.withdrawAll(this.currentMine.lpToken);
        this.updateMines();
        this.updateMinerBalance();
      }
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally {
        this.currentMine.withdrawAllLoading = false
      }
    }
  }

  public async withdrawLPTokens() { 
    if (!this.minerBalance.lpDeposit.isZero()) {
      this.currentMine.withdrawLPLoading = true;

      try {
        await this.contractService.withdrawLPTokens(this.currentMine.lpToken, this.formData.withdrawLPAmount);
        this.updateMines();
        this.updateMinerBalance();
        this.formData.ref.close();
      }
      catch (err) {
        if (err.message)
          this.openErrorModal(err.message)
      }
      finally {
        this.currentMine.withdrawLPLoading = false
      }
    }
  }

  // ONLY MANAGERS
  public async createMine() {
    if (!this.createMineData.rewardAmount || !this.createMineData.tokenAddress || !this.createMineData.startBlock || !this.createMineData.endBlock) {
      this.openErrorModal("Missing information. All fields must be filled.")
      return;
    }

    this.createMineData.progressIndicator = true;

    const rewards = this.createMineData.rewardAmount;
    const address = this.createMineData.tokenAddress;
    const startBlock = this.createMineData.startBlock;
    const endBlock = this.createMineData.endBlock;
    const blockReward = this.contractService.calculateBlockReward(rewards, startBlock, endBlock);
    
    try {
      await this.contractService.createMine(address, new BigNumber(rewards), blockReward, startBlock)
      this.createMineData.ref.close();
      this.createMineData = null;
      this.updateMines();
    }
    catch (err) {
      if (err.message)
        this.openErrorModal(err.message)
    }
    finally {
      this.createMineData.progressIndicator = false;
    }
  }
}
