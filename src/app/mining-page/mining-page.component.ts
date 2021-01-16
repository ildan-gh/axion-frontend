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
  @ViewChild("successModal", {
    static: true,
  })
  successModal: TemplateRef<any>;

  @ViewChild("warningModal", {
    static: true,
  })
  warningModal: TemplateRef<any>;

  @ViewChild("withdrawModal", {
    static: true,
  })
  withdrawModal: TemplateRef<any>;

  private warningDialog;

  public changeSort = true;

  public sortData = {
    id: true,
  } as any;

  public account;
  public tokensDecimals;
  private accountSubscribe;
  public onChangeAccount: EventEmitter<any> = new EventEmitter();

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
}
