import { Injectable } from "@angular/core";
import { ContractService } from "../services/contract";
import { Observable } from "rxjs";
import { Resolve, Router } from "@angular/router";

@Injectable({ providedIn: "root" })
export class ClaimResolver implements Resolve<any> {
  constructor(
    private contractService: ContractService,
    private router: Router
  ) {}

  private continue(observer) {
    observer.next();
    observer.complete();
  }

  resolve() {
    return new Observable((observer) => {
      this.contractService
        .getEndDateTime()
        .then((result: { leftDays: number }) => {
          const leftDaysInfoShow = result.leftDays > 0;
          // const leftDaysInfoShow = true;
          if (leftDaysInfoShow) {
            this.continue(observer);
          } else {
            this.router.navigate(["auction"]);
          }
          return false;
        });
    });
  }
}
