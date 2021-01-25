import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { Observable } from "rxjs";
import Web3 from "web3";
import { AppConfig } from "../../appconfig";
import { ContractService } from "../contract";
import { MetamaskService } from "../web3";
import { Contract } from "web3-eth-contract";

export interface Mine {
  apy: number;
  base: string;
  market: string;
  lpToken: string;
  startBlock: number;
  mineAddress: string;
  blockReward: BigNumber;
  rewardBalance: BigNumber;
  lpTokenBalance: BigNumber;
}

export interface MineInfo {
  lpToken: string;
  rewardToken: string;
  startBlock: string;
  lastRewardBlock: string;
  blockReward: string;
  accRewardPerLPToken: string;
  liqRepNFT: string;
  OG5555_25NFT: string;
  OG5555_100NFT: string;
}

@Injectable({
  providedIn: "root",
})
export class MiningContractService {
  private readonly zeroAddress = "0x0000000000000000000000000000000000000000";

  private account;
  private isActive: boolean;
  private allAccountSubscribers = [];
  private web3Service: MetamaskService;
  private allTransactionSubscribers = [];

  private contractData: any;
  private axionContract: Contract;
  private mineManagerContract: Contract;
  private mineData: { [id: string]: { contract: Contract, info: MineInfo } } = {};

  public _1e18: string;
  public mineAddresses: string[];
  public nftAddresses: { liqRepNFTAddress: string, OG5555_25NFTAddress: string, OG5555_100NFTAddress: string };

  constructor(config: AppConfig, private contractService: ContractService) {
    this._1e18 = contractService._1e18;
    this.web3Service = new MetamaskService(config);
    
    contractService.accountSubscribe().subscribe(async (account: any) => {
      if (account) {
        this.isActive = true;
        this.account = account;
        this.contractData = contractService.CONTRACTS_PARAMS;
        this.axionContract = contractService.AXNContract;

        await this.initializeContracts();
        this.callAllAccountsSubscribers();
        this.account.isManager = await this.checkIsManager();
      }
    });
  }

  public checkIsManager(): Promise<boolean> {
    return this.mineManagerContract.methods.isManager().call({ from: this.account.address });
  }

  private callAllAccountsSubscribers() {
    if (this.isActive) {
      this.allAccountSubscribers.forEach((observer) => {
        observer.next(this.account);
      });
    }
  }

  private callAllTransactionsSubscribers(transaction) {
    this.allTransactionSubscribers.forEach((observer) => {
      observer.next(transaction);
    });
  }

  private async isAXNApproved(amount, address): Promise<boolean> {
    const allowance = await this.axionContract.methods
      .allowance(this.account.address, address)
      .call();

    const allow = new BigNumber(allowance);
    const allowed = allow.minus(amount);
    return !allowed.isNegative();
  }

  private async isLPApproved(amount: BigNumber, mineAddress: string, lpTokenAddress: string): Promise<boolean> {
    const token = this.web3Service.getContract(this.contractData.ERC20.ABI, lpTokenAddress);
    const allowance = await token.methods.allowance(this.account.address, mineAddress).call();

    const allow = new BigNumber(allowance);
    const allowed = allow.minus(amount);
    return !allowed.isNegative();
  }

  private checkTransaction(tx) {
    return new Promise((resolve, reject) => {
      this.checkTx(tx, resolve, reject);
    });
  }

  private async initializeContracts() {
    this.mineManagerContract = this.web3Service.getContract(this.contractData.MineManager.ABI, this.contractData.MineManager.ADDRESS);
    await Promise.all([this.getMineAddresses(), this.getNftAddresses()]);
    await this.getMineData();
  }

  private async getNftAddresses() {
    const result = await Promise.all([
      this.mineManagerContract.methods.liqRepNFTAddress().call(),
      this.mineManagerContract.methods.OG5555_25NFTAddress().call(),
      this.mineManagerContract.methods.OG5555_100NFTAddress().call()]
    );

    this.nftAddresses = {
      liqRepNFTAddress: result[0],
      OG5555_25NFTAddress: result[1],
      OG5555_100NFTAddress: result[2]
    };
  }

  private async getMineAddresses() {
    const mineAddresses = await this.mineManagerContract.methods.getMineAddresses().call();
    this.mineAddresses = mineAddresses.filter(address => address !== this.zeroAddress)
  }

  private getMineData() {
    return Promise.all(this.mineAddresses.map(async mineAddress => {
      const contract = this.web3Service.getContract(this.contractData.Mine.ABI, mineAddress);
      const info: MineInfo = await contract.methods.mineInfo().call();

      this.mineData[mineAddress] = { contract, info };
    }));
  }

  private checkTx(tx, resolve, reject) {
    this.web3Service.Web3.eth.getTransaction(tx.transactionHash).then((txInfo) => {
      if (txInfo.blockNumber) {
        this.callAllTransactionsSubscribers(txInfo);
        resolve(tx);
      } else {
        setTimeout(() => {
          this.checkTx(tx, resolve, reject);
        }, 2000);
      }
    }, reject);
  }

  public accountSubscribe() {
    const newObserver = new Observable((observer) => {
      observer.next(this.account);
      this.allAccountSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.allAccountSubscribers = this.allAccountSubscribers.filter(a => a !== newObserver)
        },
      };
    });
    return newObserver;
  }

  public transactionsSubscribe() {
    const newObserver = new Observable((observer) => {
      this.allTransactionSubscribers.push(observer);
    });
    return newObserver;
  }

  public async getPoolTokens(lpTokenAddress: string): Promise<any> {
    if (!Web3.utils.isAddress(lpTokenAddress)) {
      throw new Error("Invalid address");
    }

    const uniPairContract = this.web3Service.getContract(this.contractData.UniswapPair.ABI, lpTokenAddress);

    // Get market token symbol
    const address = await uniPairContract.methods.token1().call();
    const contract = this.web3Service.getContract(this.contractData.ERC20.ABI, address)
    const market = await contract.methods.symbol().call();

    return {
      base: "AXN",
      market
    };
  }

  public async getNFTBalances(): Promise<any> {
    const result = {
      og25NFT: 0,
      og100NFT: 0,
      liqNFT: 0,
      reward: 0
    }

    try {
      const balances = await Promise.all([
        this.getNftTokenBalance(this.nftAddresses.OG5555_25NFTAddress),
        this.getNftTokenBalance(this.nftAddresses.OG5555_100NFTAddress),
        this.getNftTokenBalance(this.nftAddresses.liqRepNFTAddress)
      ])

      result.og25NFT = +balances[0];
      result.og100NFT = +balances[1];
      result.liqNFT = +balances[2];

      if (result.og25NFT > 0)
        result.reward += 10;
      if (result.og100NFT > 0)
        result.reward += 10;
      if (result.liqNFT > 0)
        result.reward += 10;

      return result;
    }
    catch (err) { }
  }

  public async getTokenBalance(lpTokenAddress: string): Promise<any> {
    const token = this.web3Service.getContract(this.contractData.ERC20.ABI, lpTokenAddress);
    const balance = await token.methods.balanceOf(this.account.address).call();

    return {
      wei: balance,
      bn: new BigNumber(balance)
    };
  }

  public async getNftTokenBalance(address: string): Promise<string> {
    const token = this.web3Service.getContract(this.contractData.ERC721.ABI, address);
    return await token.methods.balanceOf(this.account.address).call();
  }

  public getMines(): Promise<Mine[]> {
    return Promise.all(this.mineAddresses.map(async mineAddress => {
      const balance = await this.axionContract.methods.balanceOf(mineAddress).call();

      const mineInfo = this.mineData[mineAddress].info;
      const poolTokens = await this.getPoolTokens(mineInfo.lpToken);
      const blockReward = new BigNumber(mineInfo.blockReward);

      const pairERC20Contract = this.web3Service.getContract(this.contractData.ERC20.ABI, mineInfo.lpToken);

      const lpTokenBalance = new BigNumber(
        await pairERC20Contract.methods.balanceOf(mineAddress).call())
        .div(this.contractService._1e18);

      let apy = 30;
      try { apy = await this.getMineApr(mineInfo.lpToken, blockReward, lpTokenBalance) }
      catch (err) { console.log("Unable to calculate APY.") }

      const mine: Mine = {
        apy,
        blockReward,
        mineAddress,
        base: poolTokens.base,
        market: poolTokens.market,
        lpToken: mineInfo.lpToken,
        startBlock: +mineInfo.startBlock,
        rewardBalance: new BigNumber(balance),
        lpTokenBalance: lpTokenBalance
      };

      return mine;
    }));
  }

  private async getMineApr(lpTokenAddress: string, blockReward: BigNumber, mineLpTokenBalance: BigNumber) {
    const pairContract = this.web3Service.getContract(this.contractData.UniswapPair.ABI, lpTokenAddress);

    const tokenData = await Promise.all([
      pairContract.methods.getReserves().call(),
      pairContract.methods.token0().call(),
      pairContract.methods.token1().call(),
      pairContract.methods.totalSupply().call()
    ]);

    const tokenValues = await Promise.all([
      this.getValueInUsdc(tokenData[1], tokenData[0].reserve0),
      this.getValueInUsdc(tokenData[2], tokenData[0].reserve1)
    ]);

    const lpTokenPrice = tokenValues[0].reserve.plus(tokenValues[1].reserve).div(tokenData[3]);
    const axnTokenPrice = tokenValues.find(x => x.isAxn).tokenPrice;
    const lpTokenPriceInAxn = lpTokenPrice.div(axnTokenPrice);

    const lpSupplyValueInAxn = lpTokenPriceInAxn.times(mineLpTokenBalance);

    return blockReward.times(6500).times(365).times(100).div(lpSupplyValueInAxn).toNumber();
  }

  private async getValueInUsdc(address: string, reserve: string): Promise<{ tokenPrice: BigNumber, reserve: BigNumber, isAxn: boolean }> {
    const tokenContract = this.web3Service.getContract(this.contractData.ERC20.ABI, address);
    const tokenDecimals = await tokenContract.methods.decimals().call();
    const token_1eDecimals = Math.pow(10, tokenDecimals).toString();
    const tokenPrice = await this.contractService.getTokenToUsdcAmountsOutAsync(address, token_1eDecimals);
    return {
      tokenPrice,
      reserve: new BigNumber(reserve).div(token_1eDecimals).times(tokenPrice),
      isAxn: address === this.axionContract.options.address
    };
  }

  public async getCurrentBlock(): Promise<number> {
    return (await this.web3Service.getBlock()).number;
  }

  public async depositLPTokens(mineAddress: string, lpTokenAddress: string, amount: BigNumber): Promise<any> {
    const isApproved = await this.isLPApproved(amount, mineAddress, lpTokenAddress);

    if (!isApproved) {
      const token = this.web3Service.getContract(this.contractData.ERC20.ABI, lpTokenAddress);
      const result = await token.methods.approve(mineAddress, amount).send({ from: this.account.address });
      await this.checkTransaction(result);
    }

    const res = await this.mineData[mineAddress].contract.methods.depositLPTokens(amount).send({ from: this.account.address });
    await this.checkTransaction(res);
    return res;
  }

  public withdrawLPTokens(mineAddress: string, amount: string): Promise<any> {
    return this.mineData[mineAddress].contract.methods.withdrawLPTokens(amount).send({ from: this.account.address });
  }

  public withdrawReward(mineAddress: string): Promise<any> {
    return this.mineData[mineAddress].contract.methods.withdrawReward().send({ from: this.account.address });
  }

  public withdrawAll(mineAddress: string): Promise<any> {
    return this.mineData[mineAddress].contract.methods.withdrawAll().send({ from: this.account.address });
  }

  public async getPendingReward(mineAddress: string): Promise<BigNumber> {
    const reward = await this.mineData[mineAddress].contract.methods.getPendingReward().call({ from: this.account.address });

    return new BigNumber(reward);
  }

  public async getMinerPoolBalance(mineAddress: string): Promise<BigNumber> {
    const minerInfo = await this.mineData[mineAddress].contract.methods.minerInfo(this.account.address).call();

    return new BigNumber(minerInfo.lpDeposit);
  }

  public calculateBlockReward(rewardAmount: string, startBlock: number, endBlock: number): BigNumber {
    const blocks = endBlock - startBlock;

    return new BigNumber(rewardAmount).div(blocks).dp(0);
  }

  public async createMine(lpTokenAddress: string, rewardAmount: BigNumber, blockReward: BigNumber, startBlock: number) {
    const isApproved = await this.isAXNApproved(rewardAmount, this.mineManagerContract.options.address);

    if (!isApproved) {
      const res = await this.axionContract.methods.approve(this.mineManagerContract.options.address, rewardAmount).send({ from: this.account.address });
      await this.checkTransaction(res);
    }

    const res = await this.mineManagerContract.methods.createMine(lpTokenAddress, rewardAmount, blockReward, startBlock).send({ from: this.account.address });
    await this.checkTransaction(res);

    await this.getMineAddresses();
    await this.getMineData();

    return res;
  };

  public getUsdcPerAxnPrice(): Promise<BigNumber> {
    return this.contractService.getUsdcPerAxnPrice();
  }
}
