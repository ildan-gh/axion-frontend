import {AfterContentInit, Component, NgZone, ViewChild} from '@angular/core';
import { ContractService} from './services/contract';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterContentInit {
  public account;
  private accountSubscribe;
  public leftDaysInfo;
  public tableInfo;
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
  }

  ngAfterContentInit() {
    this.contractService.getContractsInfo().then((info) => {
      this.tableInfo = info;
      setTimeout(() => {
        this.iniRunString();
      }, 100);
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
    this.contractService.getAccount();
  }

  iniRunString() {
    const runStringElement = this.runString.nativeElement;
    const runStringItem = runStringElement.getElementsByClassName('repeat-content')[0];
    const countElements = Math.ceil(runStringElement.offsetWidth / runStringItem.offsetWidth) * 2;
    const allRepeatElements = [runStringItem];
    for (let k = 0; k < countElements; k++) {
      const newElement = runStringItem.cloneNode(true);
      runStringElement.appendChild(newElement);
      allRepeatElements.push(newElement);
    }

    setInterval(() => {
      const marginLeft = allRepeatElements[0].style.marginLeft || '0px';
      const newMarginLeft = marginLeft.replace('px', '') - 1;
      allRepeatElements[0].style.marginLeft = newMarginLeft + 'px';
      if (-newMarginLeft > allRepeatElements[0].offsetWidth) {
        const firstElement = allRepeatElements.shift();
        runStringElement.appendChild(firstElement);
        firstElement.style.marginLeft = 0;
        allRepeatElements.push(firstElement);
      }
    }, 30);
  }

}
