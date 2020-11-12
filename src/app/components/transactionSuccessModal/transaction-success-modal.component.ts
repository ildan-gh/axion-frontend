import { Component, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { settingsData } from "src/app/params";
import { HttpClient } from "@angular/common/http";
import { AppConfig } from "../../appconfig";

@Component({
  selector: "app-transaction-success-modal",
  templateUrl: "./transaction-success-modal.component.html",
})
export class TransactionSuccessModalComponent {
  public ethLink: string;
  private appConfig;
  constructor(
    public dialogRef: MatDialogRef<TransactionSuccessModalComponent>,
    private config: AppConfig,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.appConfig = config.getConfig();

    this.ethLink =
      this.appConfig.settings.network === "mainnet"
        ? `https://etherscan.io/tx/${data}`
        : `https://${this.appConfig.settings.network}.etherscan.io/tx/${data}`;
  }
  public closeModal() {
    this.dialogRef.close();
  }
}
