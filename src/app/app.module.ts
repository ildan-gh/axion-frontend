import { BrowserModule } from '@angular/platform-browser';
import {APP_INITIALIZER, NgModule, Injector} from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ClaimPageComponent } from './claim-page/claim-page.component';
import { AuctionPageComponent } from './auction-page/auction-page.component';
import {ContractService} from './services/contract';
import {FormsModule} from '@angular/forms';
import {BigNumberDirective, BigNumberFormat, BigNumberMax, BigNumberMin} from './directives/bignumber/bignumber';
import { StakingPageComponent } from './staking-page/staking-page.component';
import {MinMaxDirective} from './directives/minmax/minmax';
import {AngularFittextModule} from 'angular-fittext';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';


export function initializeApp(
  injector: Injector
) {
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

@NgModule({
  declarations: [
    AppComponent,
    ClaimPageComponent,
    AuctionPageComponent,
    BigNumberDirective,
    BigNumberFormat,
    BigNumberMin,
    BigNumberMax,
    StakingPageComponent,
    MinMaxDirective
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    AngularFittextModule
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [Injector],
      multi: true,
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
