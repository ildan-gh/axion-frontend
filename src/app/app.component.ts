import {Component, NgZone, ViewChild} from '@angular/core';
import { ContractService} from './services/contract';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent  {
  public account;
  private accountSubscribe;
  public leftDaysInfo;
  public tableInfo;
  public runLineCountArray = new Array(1);
  @ViewChild('runString', {static: false}) runString;
  constructor(
    private contractService: ContractService,
    private ngZone: NgZone,
  ) {

    this.accountSubscribe = this.contractService.accountSubscribe().subscribe((account) => {
      if (account) {
        this.accountSubscribe.unsubscribe();
        this.subscribeAccount();
      }
    });
    this.contractService.getAccount(true);

    this.contractService.getEndDateTime().then((result) => {
      this.leftDaysInfo = result;
    });

    this.contractService.getContractsInfo().then((info) => {
      this.tableInfo = info;
      this.iniRunString();
    });
  }

  public subscribeAccount() {
    if (this.account) {
      return;
    }
    this.accountSubscribe = this.contractService.accountSubscribe().subscribe((account: any) => {
      this.ngZone.run(() => {
        if (account && (!this.account || this.account.address !== account.address)) {
          this.contractService.loadAccountInfo();
        }
        this.account = account;
      });
    });
    this.contractService.getAccount().catch((err) => {
      alert(JSON.stringify(err));
    });
  }

  iniRunString() {
    const runStringElement = this.runString.nativeElement;
    const runStringItem = runStringElement.getElementsByClassName('repeat-content')[0];
    this.runLineCountArray.length = Math.ceil(runStringElement.offsetWidth / runStringItem.offsetWidth) * 2;

    setInterval(() => {
      const allElements = runStringElement.getElementsByClassName('repeat-content');
      const marginLeft = allElements[0].style.marginLeft || '0px';
      const newMarginLeft = marginLeft.replace('px', '') - 1;
      allElements[0].style.marginLeft = newMarginLeft + 'px';
      if (-newMarginLeft > allElements[0].offsetWidth) {
        allElements[0].style.marginLeft = 0;
        runStringElement.appendChild(allElements[0]);
      }
    }, 30);
  }

}
