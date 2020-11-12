import {Component, Inject} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
  selector: 'app-metamask-error',
  templateUrl: './metamask-error.component.html'
})
export class MetamaskErrorComponent {
    public err: string;
    constructor(
        public dialogRef: MatDialogRef<MetamaskErrorComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
        ) {
            this.err = data.msg;
        }
    public closeModal() {
        this.dialogRef.close();
    }
}
