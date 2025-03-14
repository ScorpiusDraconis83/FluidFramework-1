## API Report File for "@fluidframework/runtime-utils"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { FluidObject } from '@fluidframework/core-interfaces';
import { IChannelStorageService } from '@fluidframework/datastore-definitions';
import { IContainerContext } from '@fluidframework/container-definitions';
import { IContainerRuntime } from '@fluidframework/container-runtime-definitions';
import { IFluidDataStoreFactory } from '@fluidframework/runtime-definitions';
import { IFluidDataStoreRegistry } from '@fluidframework/runtime-definitions';
import { IFluidHandleContext } from '@fluidframework/core-interfaces';
import { IFluidRouter } from '@fluidframework/core-interfaces';
import { IGarbageCollectionData } from '@fluidframework/runtime-definitions';
import { IProvideFluidDataStoreRegistry } from '@fluidframework/runtime-definitions';
import { IRequest } from '@fluidframework/core-interfaces';
import { IRequestHeader } from '@fluidframework/core-interfaces';
import { IResponse } from '@fluidframework/core-interfaces';
import { IRuntime } from '@fluidframework/container-definitions';
import { IRuntimeFactory } from '@fluidframework/container-definitions';
import { ISnapshotTree } from '@fluidframework/protocol-definitions';
import { ISummarizeResult } from '@fluidframework/runtime-definitions';
import { ISummaryBlob } from '@fluidframework/protocol-definitions';
import { ISummaryStats } from '@fluidframework/runtime-definitions';
import { ISummaryTree } from '@fluidframework/protocol-definitions';
import { ISummaryTreeWithStats } from '@fluidframework/runtime-definitions';
import { ITaggedTelemetryPropertyType } from '@fluidframework/common-definitions';
import { ITelemetryContext } from '@fluidframework/runtime-definitions';
import { ITree } from '@fluidframework/protocol-definitions';
import { SummaryObject } from '@fluidframework/protocol-definitions';
import { SummaryType } from '@fluidframework/protocol-definitions';
import { TelemetryEventPropertyType } from '@fluidframework/common-definitions';

// @public (undocumented)
export function addBlobToSummary(summary: ISummaryTreeWithStats, key: string, content: string | Uint8Array): void;

// @public (undocumented)
export function addSummarizeResultToSummary(summary: ISummaryTreeWithStats, key: string, summarizeResult: ISummarizeResult): void;

// @public (undocumented)
export function addTreeToSummary(summary: ISummaryTreeWithStats, key: string, summarizeResult: ISummarizeResult): void;

// @public (undocumented)
export function calculateStats(summary: SummaryObject): ISummaryStats;

// @public
export function convertSnapshotTreeToSummaryTree(snapshot: ISnapshotTree): ISummaryTreeWithStats;

// @public
export function convertSummaryTreeToITree(summaryTree: ISummaryTree): ITree;

// @public
export function convertToSummaryTree(snapshot: ITree, fullTree?: boolean): ISummarizeResult;

// @public
export function convertToSummaryTreeWithStats(snapshot: ITree, fullTree?: boolean): ISummaryTreeWithStats;

// @public (undocumented)
export const create404Response: (request: IRequest) => IResponse;

// @public (undocumented)
export function createDataStoreFactory(type: string, factory: Factory | Promise<Factory>): IFluidDataStoreFactory & IFluidDataStoreRegistry;

// @public (undocumented)
export function createResponseError(status: number, value: string, request: IRequest, headers?: {
    [key: string]: any;
}): IResponse;

// @public (undocumented)
export function exceptionToResponse(err: any): IResponse;

// @public (undocumented)
export type Factory = IFluidDataStoreFactory & Partial<IProvideFluidDataStoreRegistry>;

// @internal
export class GCDataBuilder implements IGarbageCollectionData {
    // (undocumented)
    addNode(id: string, outboundRoutes: string[]): void;
    // (undocumented)
    addNodes(gcNodes: {
        [id: string]: string[];
    }): void;
    addRouteToAllNodes(outboundRoute: string): void;
    // (undocumented)
    get gcNodes(): {
        [id: string]: string[];
    };
    // (undocumented)
    getGCData(): IGarbageCollectionData;
    prefixAndAddNodes(prefixId: string, gcNodes: {
        [id: string]: string[];
    }): void;
}

// @public
export function generateHandleContextPath(path: string, routeContext?: IFluidHandleContext): string;

// @public (undocumented)
export function getBlobSize(content: ISummaryBlob["content"]): number;

// @public (undocumented)
export function getNormalizedObjectStoragePathParts(path: string): string[];

// @public (undocumented)
export function listBlobsAtTreePath(inputTree: ITree | undefined, path: string): Promise<string[]>;

// @public
export function mergeStats(...stats: ISummaryStats[]): ISummaryStats;

// @public
export class ObjectStoragePartition implements IChannelStorageService {
    constructor(storage: IChannelStorageService, path: string);
    // (undocumented)
    contains(path: string): Promise<boolean>;
    // (undocumented)
    list(path: string): Promise<string[]>;
    // (undocumented)
    readBlob(path: string): Promise<ArrayBufferLike>;
}

// @public
export function packagePathToTelemetryProperty(packagePath: readonly string[] | undefined): ITaggedTelemetryPropertyType | undefined;

// @public
export type ReadAndParseBlob = <T>(id: string) => Promise<T>;

// @public (undocumented)
export function requestFluidObject<T = FluidObject>(router: IFluidRouter, url: string | IRequest): Promise<T>;

// @public
export class RequestParser implements IRequest {
    protected constructor(request: Readonly<IRequest>);
    // (undocumented)
    static create(request: Readonly<IRequest>): RequestParser;
    createSubRequest(startingPathIndex: number): IRequest;
    static getPathParts(url: string): readonly string[];
    // (undocumented)
    get headers(): IRequestHeader | undefined;
    isLeaf(elements: number): boolean;
    get pathParts(): readonly string[];
    // (undocumented)
    readonly query: string;
    // (undocumented)
    get url(): string;
}

// @public (undocumented)
export function responseToException(response: IResponse, request: IRequest): Error;

// @public (undocumented)
export abstract class RuntimeFactoryHelper<T = IContainerRuntime> implements IRuntimeFactory {
    // (undocumented)
    hasInitialized(_runtime: T): Promise<void>;
    // (undocumented)
    instantiateFirstTime(_runtime: T): Promise<void>;
    // (undocumented)
    instantiateFromExisting(_runtime: T): Promise<void>;
    // (undocumented)
    instantiateRuntime(context: IContainerContext, existing: boolean): Promise<IRuntime>;
    // (undocumented)
    get IRuntimeFactory(): this;
    // (undocumented)
    abstract preInitialize(context: IContainerContext, existing: boolean): Promise<IRuntime & T>;
}

// @public
export function seqFromTree(tree: ISnapshotTree, readAndParseBlob: ReadAndParseBlob): Promise<number>;

// @public (undocumented)
export class SummaryTreeBuilder implements ISummaryTreeWithStats {
    constructor();
    // (undocumented)
    addAttachment(id: string): void;
    // (undocumented)
    addBlob(key: string, content: string | Uint8Array): void;
    // (undocumented)
    addHandle(key: string, handleType: SummaryType.Tree | SummaryType.Blob | SummaryType.Attachment, handle: string): void;
    // (undocumented)
    addWithStats(key: string, summarizeResult: ISummarizeResult): void;
    // (undocumented)
    getSummaryTree(): ISummaryTreeWithStats;
    // (undocumented)
    get stats(): Readonly<ISummaryStats>;
    // (undocumented)
    get summary(): ISummaryTree;
}

// @public (undocumented)
export class TelemetryContext implements ITelemetryContext {
    // (undocumented)
    get(prefix: string, property: string): TelemetryEventPropertyType;
    // (undocumented)
    serialize(): string;
    // (undocumented)
    set(prefix: string, property: string, value: TelemetryEventPropertyType): void;
    // (undocumented)
    setMultiple(prefix: string, property: string, values: Record<string, TelemetryEventPropertyType>): void;
}

// @public (undocumented)
export function utf8ByteLength(str: string): number;

// (No @packageDocumentation comment for this package)

```
