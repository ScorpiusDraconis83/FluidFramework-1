/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { TypedEventEmitter } from "@fluidframework/common-utils";
import { IAudience, IContainer } from "@fluidframework/container-definitions";
import { IFluidLoadable } from "@fluidframework/core-interfaces";
import { IClient } from "@fluidframework/protocol-definitions";
import { ContainerStateChangeKind } from "./Container";
import { ContainerStateMetadata } from "./ContainerMetadata";

import { IFluidClientDebugger, IFluidClientDebuggerEvents } from "./IFluidClientDebugger";
import { AudienceChangeLogEntry, ConnectionStateChangeLogEntry } from "./Logs";
import {
	AudienceClientMetaData,
	AudienceSummaryMessage,
	GetAudienceMessage,
	CloseContainerMessage,
	ConnectContainerMessage,
	DisconnectContainerMessage,
	GetContainerStateMessage,
	handleIncomingWindowMessage,
	IDebuggerMessage,
	ISourcedDebuggerMessage,
	InboundHandlers,
	MessageLoggingOptions,
	postMessagesToWindow,
	GetContainerDataMessage,
	ContainerDataMessage,
} from "./messaging";
import { FluidClientDebuggerProps } from "./Registry";

/**
 * {@link IFluidClientDebugger} implementation.
 *
 * @remarks
 *
 * This class listens to incoming messages from the window (globalThis), and posts messages to it upon relevant
 * state changes and when requested.
 *
 * **Messages it listens for:**
 *
 * - {@link GetContainerStateMessage}: When received (if the container ID matches), the debugger will broadcast {@link ContainerStateChangeMessage}.
 * - {@link ConnectContainerMessage}: When received (if the container ID matches), the debugger will connect to the container.
 * - {@link DisconnectContainerMessage}: When received (if the container ID matches), the debugger will disconnect from the container.
 * - {@link CloseContainerMessage}: When received (if the container ID matches), the debugger will close the container.
 * - {@link GetAudienceMessage}: When received (if the container ID matches), the debugger will broadcast {@link AudienceSummaryMessage}.
 * TODO: Document others as they are added.
 *
 * **Messages it posts:**
 *
 * - {@link ContainerStateChangeMessage}: This is posted any time relevant Container state changes,
 * or when requested (via {@link GetContainerStateMessage}).
 * TODO: Document others as they are added.
 *
 * @sealed
 * @internal
 */
export class FluidClientDebugger
	extends TypedEventEmitter<IFluidClientDebuggerEvents>
	implements IFluidClientDebugger
{
	/**
	 * {@inheritDoc IFluidClientDebugger.containerId}
	 */
	public readonly containerId: string;

	/**
	 * {@inheritDoc FluidClientDebuggerProps.container}
	 */
	public readonly container: IContainer;

	/**
	 * {@inheritDoc FluidClientDebuggerProps.audience}
	 */
	public get audience(): IAudience {
		return this.container.audience;
	}

	/**
	 * {@inheritDoc IFluidClientDebugger.containerData}
	 */
	public readonly containerData?: IFluidLoadable | Record<string, IFluidLoadable>;

	/**
	 * {@inheritDoc IFluidClientDebugger.containerNickname}
	 */
	public readonly containerNickname?: string;

	// #region Accumulated log state

	/**
	 * Accumulated data for {@link IFluidClientDebugger.getContainerConnectionLog}.
	 */
	private readonly _connectionStateLog: ConnectionStateChangeLogEntry[];

	/**
	 * Accumulated data for {@link IFluidClientDebugger.getAudienceHistory}.
	 */
	private readonly _audienceChangeLog: AudienceChangeLogEntry[];

	// #endregion

	// #region Container-related event handlers

	private readonly containerAttachedHandler = (): void => {
		this._connectionStateLog.push({
			newState: ContainerStateChangeKind.Attached,
			timestamp: Date.now(),
			clientId: undefined,
		});
		this.postContainerStateChange();
	};

	private readonly containerConnectedHandler = (clientId: string): void => {
		this._connectionStateLog.push({
			newState: ContainerStateChangeKind.Connected,
			timestamp: Date.now(),
			clientId,
		});
		this.postContainerStateChange();
		this.postAudienceStateChange();
	};

	private readonly containerDisconnectedHandler = (): void => {
		this._connectionStateLog.push({
			newState: ContainerStateChangeKind.Disconnected,
			timestamp: Date.now(),
			clientId: undefined,
		});
		this.postContainerStateChange();
		this.postAudienceStateChange();
	};

	private readonly containerClosedHandler = (): void => {
		this._connectionStateLog.push({
			newState: ContainerStateChangeKind.Closed,
			timestamp: Date.now(),
			clientId: undefined,
		});
		this.postContainerStateChange();
		this.postAudienceStateChange();
	};

	private readonly containerDisposedHandler = (): void => {
		this._connectionStateLog.push({
			newState: ContainerStateChangeKind.Disposed,
			timestamp: Date.now(),
			clientId: undefined,
		});
		this.postContainerStateChange();
		this.postAudienceStateChange();
	};

	// #endregion

	// #region Audience-related event handlers

	private readonly audienceMemberAddedHandler = (clientId: string, client: IClient): void => {
		this._audienceChangeLog.push({
			clientId,
			client,
			changeKind: "added",
			timestamp: Date.now(),
		});
		this.postAudienceStateChange();
	};

	private readonly audienceMemberRemovedHandler = (clientId: string, client: IClient): void => {
		this._audienceChangeLog.push({
			clientId,
			client,
			changeKind: "removed",
			timestamp: Date.now(),
		});
		this.postAudienceStateChange();
	};

	// #endregion

	// #region Window event handlers

	/**
	 * Handlers for inbound messages related to the debugger.
	 */
	private readonly inboundMessageHandlers: InboundHandlers = {
		["GET_CONTAINER_STATE"]: (untypedMessage) => {
			const message = untypedMessage as GetContainerStateMessage;
			if (message.data.containerId === this.containerId) {
				this.postContainerStateChange();
				return true;
			}
			return false;
		},
		["GET_CONTAINER_DATA"]: (untypedMessage) => {
			const message = untypedMessage as GetContainerDataMessage;
			if (message.data.containerId === this.containerId) {
				this.postContainerData();
				return true;
			}
			return false;
		},
		["CONNECT_CONTAINER"]: (untypedMessage) => {
			const message = untypedMessage as ConnectContainerMessage;
			if (message.data.containerId === this.containerId) {
				this.container.connect();
				return true;
			}
			return false;
		},
		["DISCONNECT_CONTAINER"]: (untypedMessage) => {
			const message = untypedMessage as DisconnectContainerMessage;
			if (message.data.containerId === this.containerId) {
				this.container.disconnect(/* TODO: Specify debugger reason here once it is supported */);
				return true;
			}
			return false;
		},
		["CLOSE_CONTAINER"]: (untypedMessage) => {
			const message = untypedMessage as CloseContainerMessage;
			if (message.data.containerId === this.containerId) {
				this.container.close(/* TODO: Specify debugger reason here once it is supported */);
				return true;
			}
			return false;
		},
		["GET_AUDIENCE"]: (untypedMessage) => {
			const message = untypedMessage as GetAudienceMessage;
			if (message.data.containerId === this.containerId) {
				this.postAudienceStateChange();
				return true;
			}
			return false;
		},
	};

	/**
	 * Event handler for messages coming from the window (globalThis).
	 */
	private readonly windowMessageHandler = (
		event: MessageEvent<Partial<ISourcedDebuggerMessage>>,
	): void => {
		handleIncomingWindowMessage(event, this.inboundMessageHandlers, this.messageLoggingOptions);
	};

	/**
	 * Posts a {@link ISourcedDebuggerMessage} to the window (globalThis).
	 */
	private readonly postContainerStateChange = (): void => {
		postMessagesToWindow<IDebuggerMessage>(
			this.messageLoggingOptions,
			{
				type: "CONTAINER_STATE_CHANGE",
				data: {
					containerId: this.containerId,
					containerState: this.getContainerState(),
				},
			},
			{
				type: "CONTAINER_STATE_HISTORY",
				data: {
					containerId: this.containerId,
					history: [...this._connectionStateLog],
				},
			},
		);
	};

	/**
	 * Posts a {@link ContainerDataMessage} to the window (globalThis).
	 */
	private readonly postContainerData = (): void => {
		postMessagesToWindow<ContainerDataMessage>(this.messageLoggingOptions, {
			type: "CONTAINER_DATA",
			data: {
				containerId: this.containerId,
				// TODO: fix when we can send container data as a message
				containerData:
					"THIS IS A TEST: we can't send actual container data as messages yet.", // this.containerData
			},
		});
	};

	/**
	 * Posts a {@link AudienceSummaryMessage} to the window (globalThis).
	 */
	private readonly postAudienceStateChange = (): void => {
		const allAudienceMembers = this.container.audience.getMembers();

		const audienceClientMetaData: AudienceClientMetaData[] = [
			...allAudienceMembers.entries(),
		].map(([clientId, client]): AudienceClientMetaData => {
			return { clientId, client };
		});

		postMessagesToWindow<AudienceSummaryMessage>(this.messageLoggingOptions, {
			type: "AUDIENCE_EVENT",
			data: {
				containerId: this.containerId,
				clientId: this.container.clientId,
				audienceState: audienceClientMetaData,
				audienceHistory: this.getAudienceHistory(),
			},
		});
	};

	// #endregion

	private readonly debuggerDisposedHandler = (): boolean => this.emit("disposed");

	/**
	 * Message logging options used by the debugger.
	 */
	private get messageLoggingOptions(): MessageLoggingOptions {
		return { context: `Debugger(${this.containerId})` };
	}

	/**
	 * Whether or not the instance has been disposed yet.
	 *
	 * @remarks Not related to Container disposal.
	 *
	 * @see {@link IFluidClientDebugger.dispose}
	 */
	private _disposed: boolean;

	public constructor(props: FluidClientDebuggerProps) {
		super();

		this.containerId = props.containerId;
		this.containerData = props.containerData;
		this.container = props.container;
		this.containerNickname = props.containerNickname;

		// TODO: would it be useful to log the states (and timestamps) at time of debugger initialize?
		this._connectionStateLog = [];
		this._audienceChangeLog = [];

		// Bind Container events required for change-logging
		this.container.on("attached", this.containerAttachedHandler);
		this.container.on("connected", this.containerConnectedHandler);
		this.container.on("disconnected", this.containerDisconnectedHandler);
		this.container.on("disposed", this.containerDisposedHandler);
		this.container.on("closed", this.containerClosedHandler);

		// Bind Audience events required for change-logging
		this.audience.on("addMember", this.audienceMemberAddedHandler);
		this.audience.on("removeMember", this.audienceMemberRemovedHandler);

		// Register listener for inbound messages from the window (globalThis)
		globalThis.addEventListener?.("message", this.windowMessageHandler);

		this._disposed = false;
	}

	/**
	 * {@inheritDoc IFluidClientDebugger.getConnectionStateLog}
	 */
	public getContainerConnectionLog(): readonly ConnectionStateChangeLogEntry[] {
		// Clone array contents so consumers don't see local changes
		return this._connectionStateLog.map((value) => value);
	}

	/**
	 * {@inheritDoc IFluidClientDebugger.getAudienceHistory}
	 */
	public getAudienceHistory(): readonly AudienceChangeLogEntry[] {
		// Clone array contents so consumers don't see local changes
		return this._audienceChangeLog.map((value) => value);
	}

	/**
	 * {@inheritDoc IFluidClientDebugger.dispose}
	 */
	public dispose(): void {
		// Unbind Container events
		this.container.off("attached", this.containerAttachedHandler);
		this.container.off("connected", this.containerConnectedHandler);
		this.container.off("disconnected", this.containerDisconnectedHandler);
		this.container.off("disposed", this.containerDisposedHandler);
		this.container.off("closed", this.containerClosedHandler);

		// Unbind Audience events
		this.audience.off("addMember", this.audienceMemberAddedHandler);
		this.audience.off("removeMember", this.audienceMemberRemovedHandler);

		// Unbind window event listener
		globalThis.removeEventListener?.("message", this.windowMessageHandler);

		this.debuggerDisposedHandler(); // Notify consumers that the debugger has been disposed.

		this._disposed = true;
	}

	/**
	 * {@inheritDoc @fluidframework/common-definitions#IDisposable.disposed}
	 */
	public get disposed(): boolean {
		return this._disposed;
	}

	private getContainerState(): ContainerStateMetadata {
		const clientId = this.container.clientId;
		return {
			id: this.containerId,
			nickname: this.containerNickname,
			attachState: this.container.attachState,
			connectionState: this.container.connectionState,
			closed: this.container.closed,
			clientId: this.container.clientId,
			audienceId:
				clientId === undefined ? undefined : this.audience.getMember(clientId)?.user.id,
		};
	}
}
