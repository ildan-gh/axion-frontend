import { Injectable } from "@angular/core";

@Injectable()
export class AppConfig {
  anyVariable: string = "test";
  config: any = {};

  constructor() {}

  public getConfig() {
    return this.config;
  }

  public setConfig(data) {
    this.config = data;
  }
}
