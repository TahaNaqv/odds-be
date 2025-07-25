/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from 'ethers';
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
  TypedContractMethod,
} from './common';

export declare namespace OddsLottery {
  export type TicketStruct = {
    id: BigNumberish;
    owner: AddressLike;
    isWinning: boolean;
    prizeAmount: BigNumberish;
  };

  export type TicketStructOutput = [
    id: bigint,
    owner: string,
    isWinning: boolean,
    prizeAmount: bigint,
  ] & { id: bigint; owner: string; isWinning: boolean; prizeAmount: bigint };
}

export interface OddsLotteryInterface extends Interface {
  getFunction(
    nameOrSignature:
      | 'TICKET_PRICE'
      | 'buyTickets'
      | 'createLottery'
      | 'endLottery'
      | 'getLottery'
      | 'getTicket'
      | 'getTickets'
      | 'getUserTicketsInLottery'
      | 'lotteries'
      | 'owner'
      | 'platformWallet'
      | 'renounceOwnership'
      | 'transferOwnership'
      | 'usdc',
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | 'LotteryCreated'
      | 'LotteryEnded'
      | 'OwnershipTransferred'
      | 'TicketPurchased',
  ): EventFragment;

  encodeFunctionData(
    functionFragment: 'TICKET_PRICE',
    values?: undefined,
  ): string;
  encodeFunctionData(
    functionFragment: 'buyTickets',
    values: [BigNumberish[], BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'createLottery',
    values: [BigNumberish, BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'endLottery',
    values: [BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'getLottery',
    values: [BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'getTicket',
    values: [BigNumberish, BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'getTickets',
    values: [BigNumberish],
  ): string;
  encodeFunctionData(
    functionFragment: 'getUserTicketsInLottery',
    values: [BigNumberish, AddressLike],
  ): string;
  encodeFunctionData(
    functionFragment: 'lotteries',
    values: [BigNumberish],
  ): string;
  encodeFunctionData(functionFragment: 'owner', values?: undefined): string;
  encodeFunctionData(
    functionFragment: 'platformWallet',
    values?: undefined,
  ): string;
  encodeFunctionData(
    functionFragment: 'renounceOwnership',
    values?: undefined,
  ): string;
  encodeFunctionData(
    functionFragment: 'transferOwnership',
    values: [AddressLike],
  ): string;
  encodeFunctionData(functionFragment: 'usdc', values?: undefined): string;

  decodeFunctionResult(
    functionFragment: 'TICKET_PRICE',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(functionFragment: 'buyTickets', data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: 'createLottery',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(functionFragment: 'endLottery', data: BytesLike): Result;
  decodeFunctionResult(functionFragment: 'getLottery', data: BytesLike): Result;
  decodeFunctionResult(functionFragment: 'getTicket', data: BytesLike): Result;
  decodeFunctionResult(functionFragment: 'getTickets', data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: 'getUserTicketsInLottery',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(functionFragment: 'lotteries', data: BytesLike): Result;
  decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: 'platformWallet',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(
    functionFragment: 'renounceOwnership',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(
    functionFragment: 'transferOwnership',
    data: BytesLike,
  ): Result;
  decodeFunctionResult(functionFragment: 'usdc', data: BytesLike): Result;
}

export namespace LotteryCreatedEvent {
  export type InputTuple = [lotteryId: BigNumberish, maxTickets: BigNumberish];
  export type OutputTuple = [lotteryId: bigint, maxTickets: bigint];
  export interface OutputObject {
    lotteryId: bigint;
    maxTickets: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace LotteryEndedEvent {
  export type InputTuple = [
    lotteryId: BigNumberish,
    winningTicketIds: BigNumberish[],
    secondPlaceTicketIds: BigNumberish[],
    prizePool: BigNumberish,
    platformCut: BigNumberish,
    distributedPool: BigNumberish,
    totalTicketsSold: BigNumberish,
    firstPlacePrizePerTicket: BigNumberish,
    secondPlacePrizePerTicket: BigNumberish,
  ];
  export type OutputTuple = [
    lotteryId: bigint,
    winningTicketIds: bigint[],
    secondPlaceTicketIds: bigint[],
    prizePool: bigint,
    platformCut: bigint,
    distributedPool: bigint,
    totalTicketsSold: bigint,
    firstPlacePrizePerTicket: bigint,
    secondPlacePrizePerTicket: bigint,
  ];
  export interface OutputObject {
    lotteryId: bigint;
    winningTicketIds: bigint[];
    secondPlaceTicketIds: bigint[];
    prizePool: bigint;
    platformCut: bigint;
    distributedPool: bigint;
    totalTicketsSold: bigint;
    firstPlacePrizePerTicket: bigint;
    secondPlacePrizePerTicket: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace OwnershipTransferredEvent {
  export type InputTuple = [previousOwner: AddressLike, newOwner: AddressLike];
  export type OutputTuple = [previousOwner: string, newOwner: string];
  export interface OutputObject {
    previousOwner: string;
    newOwner: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace TicketPurchasedEvent {
  export type InputTuple = [
    lotteryId: BigNumberish,
    buyer: AddressLike,
    ticketId: BigNumberish,
  ];
  export type OutputTuple = [
    lotteryId: bigint,
    buyer: string,
    ticketId: bigint,
  ];
  export interface OutputObject {
    lotteryId: bigint;
    buyer: string;
    ticketId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface OddsLottery extends BaseContract {
  connect(runner?: ContractRunner | null): OddsLottery;
  waitForDeployment(): Promise<this>;

  interface: OddsLotteryInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>,
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>,
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>,
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>,
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent,
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent,
  ): Promise<this>;

  TICKET_PRICE: TypedContractMethod<[], [bigint], 'view'>;

  buyTickets: TypedContractMethod<
    [lotteryIds: BigNumberish[], count: BigNumberish],
    [void],
    'nonpayable'
  >;

  createLottery: TypedContractMethod<
    [lotteryId: BigNumberish, maxTickets: BigNumberish],
    [void],
    'nonpayable'
  >;

  endLottery: TypedContractMethod<
    [lotteryId: BigNumberish],
    [void],
    'nonpayable'
  >;

  getLottery: TypedContractMethod<
    [lotteryId: BigNumberish],
    [
      [bigint, bigint, bigint, boolean, boolean, bigint] & {
        id: bigint;
        maxTickets: bigint;
        ticketsSold: bigint;
        isActive: boolean;
        isDrawn: boolean;
        createdAt: bigint;
      },
    ],
    'view'
  >;

  getTicket: TypedContractMethod<
    [lotteryId: BigNumberish, ticketId: BigNumberish],
    [OddsLottery.TicketStructOutput],
    'view'
  >;

  getTickets: TypedContractMethod<
    [lotteryId: BigNumberish],
    [OddsLottery.TicketStructOutput[]],
    'view'
  >;

  getUserTicketsInLottery: TypedContractMethod<
    [lotteryId: BigNumberish, user: AddressLike],
    [OddsLottery.TicketStructOutput[]],
    'view'
  >;

  lotteries: TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, bigint, bigint, boolean, boolean, bigint] & {
        id: bigint;
        maxTickets: bigint;
        ticketsSold: bigint;
        isActive: boolean;
        isDrawn: boolean;
        createdAt: bigint;
      },
    ],
    'view'
  >;

  owner: TypedContractMethod<[], [string], 'view'>;

  platformWallet: TypedContractMethod<[], [string], 'view'>;

  renounceOwnership: TypedContractMethod<[], [void], 'nonpayable'>;

  transferOwnership: TypedContractMethod<
    [newOwner: AddressLike],
    [void],
    'nonpayable'
  >;

  usdc: TypedContractMethod<[], [string], 'view'>;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment,
  ): T;

  getFunction(
    nameOrSignature: 'TICKET_PRICE',
  ): TypedContractMethod<[], [bigint], 'view'>;
  getFunction(
    nameOrSignature: 'buyTickets',
  ): TypedContractMethod<
    [lotteryIds: BigNumberish[], count: BigNumberish],
    [void],
    'nonpayable'
  >;
  getFunction(
    nameOrSignature: 'createLottery',
  ): TypedContractMethod<
    [lotteryId: BigNumberish, maxTickets: BigNumberish],
    [void],
    'nonpayable'
  >;
  getFunction(
    nameOrSignature: 'endLottery',
  ): TypedContractMethod<[lotteryId: BigNumberish], [void], 'nonpayable'>;
  getFunction(nameOrSignature: 'getLottery'): TypedContractMethod<
    [lotteryId: BigNumberish],
    [
      [bigint, bigint, bigint, boolean, boolean, bigint] & {
        id: bigint;
        maxTickets: bigint;
        ticketsSold: bigint;
        isActive: boolean;
        isDrawn: boolean;
        createdAt: bigint;
      },
    ],
    'view'
  >;
  getFunction(
    nameOrSignature: 'getTicket',
  ): TypedContractMethod<
    [lotteryId: BigNumberish, ticketId: BigNumberish],
    [OddsLottery.TicketStructOutput],
    'view'
  >;
  getFunction(
    nameOrSignature: 'getTickets',
  ): TypedContractMethod<
    [lotteryId: BigNumberish],
    [OddsLottery.TicketStructOutput[]],
    'view'
  >;
  getFunction(
    nameOrSignature: 'getUserTicketsInLottery',
  ): TypedContractMethod<
    [lotteryId: BigNumberish, user: AddressLike],
    [OddsLottery.TicketStructOutput[]],
    'view'
  >;
  getFunction(nameOrSignature: 'lotteries'): TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, bigint, bigint, boolean, boolean, bigint] & {
        id: bigint;
        maxTickets: bigint;
        ticketsSold: bigint;
        isActive: boolean;
        isDrawn: boolean;
        createdAt: bigint;
      },
    ],
    'view'
  >;
  getFunction(
    nameOrSignature: 'owner',
  ): TypedContractMethod<[], [string], 'view'>;
  getFunction(
    nameOrSignature: 'platformWallet',
  ): TypedContractMethod<[], [string], 'view'>;
  getFunction(
    nameOrSignature: 'renounceOwnership',
  ): TypedContractMethod<[], [void], 'nonpayable'>;
  getFunction(
    nameOrSignature: 'transferOwnership',
  ): TypedContractMethod<[newOwner: AddressLike], [void], 'nonpayable'>;
  getFunction(
    nameOrSignature: 'usdc',
  ): TypedContractMethod<[], [string], 'view'>;

  getEvent(
    key: 'LotteryCreated',
  ): TypedContractEvent<
    LotteryCreatedEvent.InputTuple,
    LotteryCreatedEvent.OutputTuple,
    LotteryCreatedEvent.OutputObject
  >;
  getEvent(
    key: 'LotteryEnded',
  ): TypedContractEvent<
    LotteryEndedEvent.InputTuple,
    LotteryEndedEvent.OutputTuple,
    LotteryEndedEvent.OutputObject
  >;
  getEvent(
    key: 'OwnershipTransferred',
  ): TypedContractEvent<
    OwnershipTransferredEvent.InputTuple,
    OwnershipTransferredEvent.OutputTuple,
    OwnershipTransferredEvent.OutputObject
  >;
  getEvent(
    key: 'TicketPurchased',
  ): TypedContractEvent<
    TicketPurchasedEvent.InputTuple,
    TicketPurchasedEvent.OutputTuple,
    TicketPurchasedEvent.OutputObject
  >;

  filters: {
    'LotteryCreated(uint256,uint256)': TypedContractEvent<
      LotteryCreatedEvent.InputTuple,
      LotteryCreatedEvent.OutputTuple,
      LotteryCreatedEvent.OutputObject
    >;
    LotteryCreated: TypedContractEvent<
      LotteryCreatedEvent.InputTuple,
      LotteryCreatedEvent.OutputTuple,
      LotteryCreatedEvent.OutputObject
    >;

    'LotteryEnded(uint256,uint256[],uint256[],uint256,uint256,uint256,uint256,uint256,uint256)': TypedContractEvent<
      LotteryEndedEvent.InputTuple,
      LotteryEndedEvent.OutputTuple,
      LotteryEndedEvent.OutputObject
    >;
    LotteryEnded: TypedContractEvent<
      LotteryEndedEvent.InputTuple,
      LotteryEndedEvent.OutputTuple,
      LotteryEndedEvent.OutputObject
    >;

    'OwnershipTransferred(address,address)': TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;
    OwnershipTransferred: TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;

    'TicketPurchased(uint256,address,uint256)': TypedContractEvent<
      TicketPurchasedEvent.InputTuple,
      TicketPurchasedEvent.OutputTuple,
      TicketPurchasedEvent.OutputObject
    >;
    TicketPurchased: TypedContractEvent<
      TicketPurchasedEvent.InputTuple,
      TicketPurchasedEvent.OutputTuple,
      TicketPurchasedEvent.OutputObject
    >;
  };
}
