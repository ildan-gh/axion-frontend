import { Component, NgZone, ViewChild, OnInit } from "@angular/core";
import { TransactionSuccessModalComponent } from "./components/transactionSuccessModal/transaction-success-modal.component";
import { MetamaskErrorComponent } from "./components/metamaskError/metamask-error.component";
import { ContractService } from "./services/contract";
import { MatDialog } from "@angular/material/dialog";
import { ActivationStart, NavigationStart, Router } from "@angular/router";
import { CookieService } from "ngx-cookie-service";
import { AppConfig } from "./appconfig";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  public isNavbarOpen;
  public isHeaderActive;
  public account;
  private accountSubscribe;
  public leftDaysInfo;
  public leftDaysInfoShow = false;
  public leftDaysInfoChecker = false;
  public addToMetamask = false;
  public theme = "white";
  public themeSwitch = false;
  public chainNetwork = "rinkeby";
  public tableInfo;
  public bannerForClaim = false;
  public runLineCountArray = new Array(1);
  private firstInitialization = false;
  @ViewChild("runString", { static: false }) runString;
  constructor(
    private contractService: ContractService,
    private ngZone: NgZone,
    public dialog: MatDialog,
    private cookieService: CookieService,
    private config: AppConfig,
    private route: Router
  ) {
    this.theme = this.cookieService.get("theme")
      ? this.cookieService.get("theme")
      : "white";

    this.themeSwitch = this.theme === "white";

    this.changeTheme(true);

    const settingsData = config.getConfig();

    if (window["ethereum"]) {
      window["ethereum"].on("chainChanged", () => {
        window["ethereum"]
          .request({
            method: "net_version",
          })
          .then((result) => {
            this.addToMetamask = settingsData.settings.chainsForButtonAddToMetamask.includes(
              Number(result)
            );
          });
      });

      window["ethereum"]
        .request({
          method: "net_version",
        })
        .then((result) => {
          this.addToMetamask = settingsData.settings.chainsForButtonAddToMetamask.includes(
            Number(result)
          );
        });
    }


    this.chainNetwork = settingsData.settings.network;

    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account) => {
        if (account) {
          if (!this.firstInitialization) {
            this.contractService.getContractsInfo().then((info) => {
              this.tableInfo = info;
              this.iniRunString();
            });
          }
          this.firstInitialization = true;
          this.accountSubscribe.unsubscribe();
          this.subscribeAccount();

          this.contractService.getEndDateTime().then((result) => {
            this.leftDaysInfo = result;
            this.leftDaysInfoShow = this.leftDaysInfo.leftDays > 0;

            if (this.leftDaysInfoShow) {
              this.leftDaysInfoChecker = true;
              // if (this.account) {
              this.checkDays();
              // }
            }
          });
        }
      });

    this.contractService
      .transactionsSubscribe()
      .subscribe((transaction: any) => {
        // console.log("transaction", transaction);

        if (transaction) {
          this.dialog.open(TransactionSuccessModalComponent, {
            width: "440px",
            data: transaction.hash,
          });
        }
      });
    this.contractService.getAccount(true);

    this.isNavbarOpen = false;

    this.isHeaderActive = false;

    route.events.subscribe((event) => {
      if (event instanceof ActivationStart) {
        this.bannerForClaim = event.snapshot.url[0].path === "claim";
        if (event.snapshot.queryParams.ref) {
          this.cookieService.set("ref", event.snapshot.queryParams.ref);
        }
      }

      if (event instanceof NavigationStart) {
        window.scrollTo(0, 0);
      }
    });
  }

  public addToken() {
    this.contractService.addToken();
  }

  public changeTheme(switchTheme?) {
    const themeName = switchTheme
      ? this.theme
      : this.theme === "white"
      ? "dark"
      : "white";

    const body = document.getElementsByTagName("body")[0];
    body.className = body.className.replace(this.theme, "");
    body.className += themeName;
    this.theme = themeName;

    this.cookieService.set("theme", themeName);
  }

  public checkDays() {
    if (this.leftDaysInfoChecker) {
      setTimeout(() => {
        this.contractService.getEndDateTimeCurrent().then((result) => {
          this.leftDaysInfo = result;
          this.leftDaysInfoShow = this.leftDaysInfo.leftDays > 0;
          if (!this.leftDaysInfoShow) {
            this.leftDaysInfoChecker = false;
          } else {
            this.checkDays();
            // console.log("app days checker", result);
          }
        });
      }, 1000);
    }
  }

  public openNavbar() {
    this.isNavbarOpen = !this.isNavbarOpen;
  }

  public subscribeAccount() {
    if (this.account) {
      return;
    }
    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        this.ngZone.run(() => {
          if (
            account &&
            (!this.account || this.account.address !== account.address)
          ) {
            this.contractService.loadAccountInfo();
          }
          this.account = account;
        });
      });
    this.contractService.getAccount().catch((err) => {
      this.dialog.open(MetamaskErrorComponent, {
        width: "400px",
        data: err,
      });
    });
  }

  iniRunString() {
    const runStringElement = this.runString.nativeElement;
    const runStringItem = runStringElement.getElementsByClassName(
      "repeat-content"
    )[0];
    this.runLineCountArray.length =
      Math.ceil(runStringElement.offsetWidth / runStringItem.offsetWidth) * 2;

    setInterval(() => {
      const allElements = runStringElement.getElementsByClassName(
        "repeat-content"
      );
      const marginLeft = allElements[0].style.marginLeft || "0px";
      const newMarginLeft = marginLeft.replace("px", "") - 1;
      allElements[0].style.marginLeft = newMarginLeft + "px";
      if (-newMarginLeft > allElements[0].offsetWidth) {
        allElements[0].style.marginLeft = 0;
        runStringElement.appendChild(allElements[0]);
      }
    }, 30);
  }

  private onScrollWindow() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    this.isHeaderActive = scrollTop >= 10;
  }

  ngOnInit(): void {
    window.addEventListener("scroll", this.onScrollWindow.bind(this));
  }
}
