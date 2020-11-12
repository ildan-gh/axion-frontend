import { BrowserModule } from "@angular/platform-browser";
import { APP_INITIALIZER, NgModule, Injector, LOCALE_ID } from "@angular/core";
import { ClipboardModule } from "ngx-clipboard";
import { CookieService } from "ngx-cookie-service";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ClaimPageComponent } from "./claim-page/claim-page.component";
import { AuctionPageComponent } from "./auction-page/auction-page.component";
import { TransactionSuccessModalComponent } from "./components/transactionSuccessModal/transaction-success-modal.component";
import { MetamaskErrorComponent } from "./components/metamaskError/metamask-error.component";
import { ContractService } from "./services/contract";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  BigNumberDirective,
  BigNumberFormat,
  BigNumberMax,
  BigNumberMin,
} from "./directives/bignumber/bignumber";
import { StakingPageComponent } from "./staking-page/staking-page.component";
import { MinMaxDirective } from "./directives/minmax/minmax";
import { AngularFittextModule } from "angular-fittext";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { MatDialogModule, MatTooltipModule } from "@angular/material";
import { AppConfig } from "./appconfig";

export function initializeApp(injector: Injector) {
  return () =>
    new Promise<any>((resolve: any) => {
      const contractService = injector.get(
        ContractService,
        Promise.resolve(null)
      );
      contractService.getStaticInfo().then(() => {
        resolve(null);
      });
    });
}

import { LocaleService } from "./services/locale/locale.service";
import { registerLocaleData } from "@angular/common";
import localeGB from "@angular/common/locales/en-GB";
registerLocaleData(localeGB, "en-gb");

@NgModule({
  entryComponents: [TransactionSuccessModalComponent, MetamaskErrorComponent],
  declarations: [
    AppComponent,
    ClaimPageComponent,
    AuctionPageComponent,
    TransactionSuccessModalComponent,
    MetamaskErrorComponent,
    BigNumberDirective,
    BigNumberFormat,
    BigNumberMin,
    BigNumberMax,
    StakingPageComponent,
    MinMaxDirective,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule,
    AngularFittextModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ClipboardModule,
  ],
  providers: [
    LocaleService,
    AppConfig,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [Injector],
      multi: true,
    },
    CookieService,
    {
      provide: LOCALE_ID,
      deps: [LocaleService],
      useFactory: (LocaleService: { locale: string }) => LocaleService.locale,
      // useFactory: (LocaleService) => LocaleService.initCulture(),
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
