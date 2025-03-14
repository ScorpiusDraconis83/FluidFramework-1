/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ContainerStateMetadata } from "../ContainerMetadata";
import { ConnectionStateChangeLogEntry } from "../Logs";
import { IDebuggerMessage } from "./Messages";

/**
 * Base interface used in message data for events targeting a particular debugger instance via
 * its Container ID.
 *
 * @public
 */
export interface HasContainerId {
	/**
	 * The ID of the Container whose metadata is being requested.
	 */
	containerId: string;
}

// #region Inbound messages

/**
 * Message data format used by {@link GetContainerStateMessage}.
 *
 * @public
 */
export type GetContainerStateMessageData = HasContainerId;

/**
 * Message data format used by {@link ConnectContainerMessage}.
 *
 * @public
 */
export type ConnectContainerMessageData = HasContainerId;

/**
 * Message data format used by {@link DisconnectContainerMessage}.
 *
 * @public
 */
export type DisconnectContainerMessageData = HasContainerId;

/**
 * Message data format used by {@link CloseContainerMessage}.
 *
 * @public
 */
export type CloseContainerMessageData = HasContainerId;

/**
 * Message data format used by {@link ContainerStateHistoryMessage}.
 *
 * @public
 */
export interface ContainerStateHistoryMessageData extends HasContainerId {
	/**
	 * The Container's connection state history.
	 */
	history: ConnectionStateChangeLogEntry[];
}

/**
 * Inbound event requesting the {@link ContainerStateMetadata} of the Container with the specified ID.
 * Will result in the {@link ContainerStateChangeMessage} message being posted.
 *
 * @public
 */
export interface GetContainerStateMessage extends IDebuggerMessage<HasContainerId> {
	type: "GET_CONTAINER_STATE";
}

/**
 * Inbound event requesting the data in the Container with the specified ID.
 * Will result in the {@link ContainerDataMessage} message being posted.
 *
 * @public
 */
export interface GetContainerDataMessage extends IDebuggerMessage<HasContainerId> {
	type: "GET_CONTAINER_DATA";
}

// #endregion

// #region Outbound messages

/**
 * Message data format used by {@link ContainerStateChangeMessage}.
 *
 * @public
 */
export interface ContainerStateChangeMessageData extends HasContainerId {
	/**
	 * Updated Container state metadata.
	 */
	containerState: ContainerStateMetadata;

	// TODO: change logs
}

/**
 * Outbound event indicating a state change within a Container.
 *
 * @public
 */
export interface ContainerStateChangeMessage
	extends IDebuggerMessage<ContainerStateChangeMessageData> {
	type: "CONTAINER_STATE_CHANGE";
}

/**
 * Inbound event indicating Container connected.
 *
 * @public
 */
export interface ConnectContainerMessage extends IDebuggerMessage<ConnectContainerMessageData> {
	type: "CONNECT_CONTAINER";
}

/**
 * Inbound event indicating Container disconnected.
 *
 * @public
 */
export interface DisconnectContainerMessage
	extends IDebuggerMessage<DisconnectContainerMessageData> {
	type: "DISCONNECT_CONTAINER";
}

/**
 * Inbound event indicating Container closed.
 *
 * @public
 */
export interface CloseContainerMessage extends IDebuggerMessage<CloseContainerMessageData> {
	type: "CLOSE_CONTAINER";
}

/**
 * Outbound event indicating Container state history.
 *
 * @public
 */
export interface ContainerStateHistoryMessage
	extends IDebuggerMessage<ContainerStateHistoryMessageData> {
	type: "CONTAINER_STATE_HISTORY";
}

/**
 * Message data format used by {@link ContainerDataMessage}.
 *
 * @public
 */
export interface ContainerDataMessageData extends HasContainerId {
	/**
	 * Updated Container state metadata.
	 */
	containerData?: unknown;
}

/**
 * Outbound event with the Container data.
 *
 * @public
 */
export interface ContainerDataMessage extends IDebuggerMessage<ContainerDataMessageData> {
	type: "CONTAINER_DATA";
}

// #endregion
