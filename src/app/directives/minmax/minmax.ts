import {Directive, Injector, Input, OnInit} from '@angular/core';
import {NgControl} from '@angular/forms';

@Directive({
  selector: '[appMinMaxNumber]'
})
export class MinMaxDirective implements OnInit {
  private control: NgControl;
  private latestValue;

  @Input ('appMinMaxNumber') appMinMaxNumber;
  @Input ('ngModel') ngModel;
  @Input ('required') required;

  constructor(
    private injector: Injector,
  ) {
    this.control = this.injector.get(NgControl);
  }

  ngOnInit() {

    const originalWriteVal = this.control.valueAccessor.writeValue.bind(this.control.valueAccessor);

    this.control.valueChanges.subscribe((result: string) => {

      result = result || '';

      if (isNaN(+result)) {
        result = (result !== '') ? this.latestValue : '';
      }

      const errors: any = {};

      if (!result && this.required) {
        errors.required = true;
      } else {
        if (+result < this.appMinMaxNumber.min) {
          if (!this.latestValue || this.latestValue < this.appMinMaxNumber.min) {
            errors.min = true;
          } else {
            result = this.latestValue;
          }
        }
        if (+result > this.appMinMaxNumber.max) {
          if (!this.latestValue || this.latestValue > this.appMinMaxNumber.max) {
            errors.max = true;
          } else {
            result = this.latestValue;
          }
        }
      }

      if (JSON.stringify(errors) === '{}') {
        this.latestValue = result;
        this.control.control.setValue(result, {
          emitEvent: false
        });
        this.control.control.setErrors(null);
      } else {
        if (result) {
          this.control.control.markAsTouched();
        }
        this.control.control.setValue(result, {
          emitEvent: false
        });
        this.control.control.setErrors(errors);
      }

    });
  }
}
