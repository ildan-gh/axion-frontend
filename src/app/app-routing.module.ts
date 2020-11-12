import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ClaimPageComponent } from "./claim-page/claim-page.component";
import { AuctionPageComponent } from "./auction-page/auction-page.component";
import { StakingPageComponent } from "./staking-page/staking-page.component";
import { ClaimResolver } from "./resolvers/Claim";

const routes: Routes = [
  {
    path: "claim",
    component: ClaimPageComponent,
  },
  {
    path: "auction",
    component: AuctionPageComponent,
  },
  {
    path: "staking",
    component: StakingPageComponent,
  },
  {
    path: "**",
    redirectTo: "claim",
    pathMatch: "full",
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
