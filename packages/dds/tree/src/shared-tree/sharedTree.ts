/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	IChannelAttributes,
	IChannelFactory,
	IChannelServices,
	IFluidDataStoreRuntime,
} from "@fluidframework/datastore-definitions";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { ISharedObject } from "@fluidframework/shared-object-base";
import {
	IForestSubscription,
	StoredSchemaRepository,
	InMemoryStoredSchemaRepository,
	Anchor,
	AnchorLocator,
	AnchorSet,
	AnchorNode,
	IEditableForest,
	AnchorSetRootEvents,
} from "../core";
import { SharedTreeBranch, SharedTreeCore } from "../shared-tree-core";
import {
	defaultSchemaPolicy,
	EditableTreeContext,
	ForestSummarizer,
	SchemaSummarizer as SchemaSummarizer,
	DefaultChangeFamily,
	defaultChangeFamily,
	DefaultEditBuilder,
	UnwrappedEditableField,
	getEditableTreeContext,
	SchemaEditor,
	DefaultChangeset,
	buildForest,
	ContextuallyTypedNodeData,
	IDefaultEditBuilder,
	ForestRepairDataStore,
} from "../feature-libraries";
import { IEmitter, ISubscribable, createEmitter } from "../events";
import { TransactionResult } from "../util";

/**
 * Events for {@link ISharedTreeView}.
 * @alpha
 */
export interface ViewEvents {
	/**
	 * A batch of changes has finished processing and the view is in a consistent state.
	 * It is once again safe to access the EditableTree, Forest and AnchorSet.
	 *
	 * @remarks
	 * This is mainly useful for knowing when to do followup work scheduled during events from Anchors.
	 */
	afterBatch(): void;
}

/**
 * Provides a means for interacting with a SharedTree.
 * This includes reading data from the tree and running transactions to mutate the tree.
 * @alpha
 */
export interface ISharedTreeView extends AnchorLocator {
	/**
	 * Gets or sets the root field of the tree.
	 *
	 * See {@link EditableTreeContext.unwrappedRoot} on how its setter works.
	 *
	 * Currently this editable tree's fields do not update on edits,
	 * so holding onto this root object across edits will only work if its an unwrapped node.
	 * TODO: Fix this issue.
	 *
	 * Currently any access to this view of the tree may allocate cursors and thus require
	 * `context.prepareForEdit()` before editing can occur.
	 */
	// TODO: either rename this or `EditableTreeContext.unwrappedRoot` to avoid name confusion.
	get root(): UnwrappedEditableField;

	set root(data: ContextuallyTypedNodeData | undefined);

	/**
	 * Context for controlling the EditableTree nodes produced from {@link ISharedTreeView.root}.
	 *
	 * TODO: Exposing access to this should be unneeded once editing APIs are finished.
	 */
	readonly context: EditableTreeContext;

	/**
	 * Read and Write access for schema stored in the document.
	 *
	 * These APIs are temporary and will be replaced with different abstractions (View Schema based) in a different place later.
	 *
	 * TODO:
	 * Editing of this should be moved into transactions with the rest of tree editing to they can be intermixed.
	 * This will be done after the relations between views, branches and Indexes are figured out.
	 *
	 * TODO:
	 * Public APIs for dealing with schema should be in terms of View Schema, and schema update policies.
	 * The actual stored schema should be hidden (or ar least not be the most prominent way to interact with schema).
	 *
	 * TODO:
	 * Something should ensure the document contents are always in schema.
	 */
	readonly storedSchema: StoredSchemaRepository;
	/**
	 * Current contents.
	 * Updated by edits (local and remote).
	 * Use `editor` to create a local edit.
	 */
	readonly forest: IForestSubscription;

	/**
	 * Used to edit the state of the tree. Edits will be immediately applied locally to the tree.
	 * If there is no transaction currently ongoing, then the edits will be submitted to Fluid immediately as well.
	 */
	readonly editor: IDefaultEditBuilder;

	/**
	 * An collection of functions for managing transactions.
	 * Transactions allow edits to be batched into atomic units.
	 * Edits made during a transaction will update the local state of the tree immediately, but will be squashed into a single edit when the transaction is committed.
	 * If the transaction is aborted, the local state will be reset to what it was before the transaction began.
	 * Transactions may nest, meaning that a transaction may be started while a transaction is already ongoing.
	 *
	 * To avoid updating observers of the view state with intermediate results during a transaction,
	 * use {@link ISharedTreeView#fork} and {@link ISharedTreeFork#merge}.
	 */
	readonly transaction: {
		/**
		 * Start a new transaction.
		 * If a transaction is already in progress when this new transaction starts, then this transaction will be "nested" inside of it,
		 * i.e. the outer transaction will still be in progress after this new transaction is committed or aborted.
		 */
		start(): void;
		/**
		 * Close this transaction by squashing its edits and committing them as a single edit.
		 * If this is the root view and there are no ongoing transactions remaining, the squashed edit will be submitted to Fluid.
		 */
		commit(): TransactionResult.Commit;
		/**
		 * Close this transaction and revert the state of the tree to what it was before this transaction began.
		 */
		abort(): TransactionResult.Abort;
		/**
		 * True if there is at least one transaction currently in progress on this view, otherwise false.
		 */
		inProgress(): boolean;
	};

	/**
	 * Spawn a new view which is based off of the current state of this view.
	 * Any mutations of the new view will not apply to this view until the new view is merged back into this view via `merge()`.
	 */
	fork(): ISharedTreeFork;

	/**
	 * Events about this view.
	 */
	readonly events: ISubscribable<ViewEvents>;

	/**
	 * Events about the root of the tree in this view.
	 */
	readonly rootEvents: ISubscribable<AnchorSetRootEvents>;
}

/**
 * An `ISharedTreeView` which has been forked from a pre-existing view.
 * @alpha
 */
export interface ISharedTreeFork extends ISharedTreeView {
	/**
	 * Rebase the changes that have been applied to this view over all the changes in the base view that have
	 * occurred since this view last pulled (or was forked).
	 */
	pull(): void;

	/**
	 * Apply all the changes on this view to the base view from which it was forked.
	 * If the base view has new changes since this view last pulled (or was forked),
	 * then this view's changes will be rebased over those first.
	 * After the merge completes, this view may no longer be forked or mutated.
	 */
	merge(): void;

	/**
	 * Whether or not this view has been merged into its base view via `merge()`.
	 * If it has, then it may no longer be forked or mutated.
	 */
	isMerged(): boolean;
}

/**
 * Collaboratively editable tree distributed data-structure,
 * powered by {@link @fluidframework/shared-object-base#ISharedObject}.
 *
 * See [the README](../../README.md) for details.
 * @alpha
 */
export interface ISharedTree extends ISharedObject, ISharedTreeView {}

/**
 * Shared tree, configured with a good set of indexes and field kinds which will maintain compatibility over time.
 * TODO: node identifier index.
 *
 * TODO: detail compatibility requirements.
 */
class SharedTree
	extends SharedTreeCore<DefaultEditBuilder, DefaultChangeset>
	implements ISharedTree
{
	public readonly context: EditableTreeContext;
	public readonly forest: IEditableForest;
	public readonly storedSchema: SchemaEditor<InMemoryStoredSchemaRepository>;
	public readonly transaction: ISharedTreeView["transaction"];

	public readonly events: ISubscribable<ViewEvents> & IEmitter<ViewEvents>;
	public get rootEvents(): ISubscribable<AnchorSetRootEvents> {
		return this.forest.anchors;
	}

	public constructor(
		id: string,
		runtime: IFluidDataStoreRuntime,
		attributes: IChannelAttributes,
		telemetryContextPrefix: string,
	) {
		const anchors = new AnchorSet();
		const schema = new InMemoryStoredSchemaRepository(defaultSchemaPolicy);
		const forest = buildForest(schema, anchors);
		const schemaSummarizer = new SchemaSummarizer(runtime, schema);
		const forestSummarizer = new ForestSummarizer(runtime, forest);
		super(
			[schemaSummarizer, forestSummarizer],
			defaultChangeFamily,
			anchors,
			id,
			runtime,
			attributes,
			telemetryContextPrefix,
		);

		this.events = createEmitter<ViewEvents>();
		this.forest = forest;
		this.storedSchema = new SchemaEditor(schema, (op) => this.submitLocalMessage(op));

		this.transaction = {
			start: () => this.startTransaction(new ForestRepairDataStore(() => this.forest)),
			commit: () => this.commitTransaction(),
			abort: () => this.abortTransaction(),
			inProgress: () => this.isTransacting(),
		};

		this.context = getEditableTreeContext(forest, this.editor);
		this.changeEvents.on("newLocalState", (changeDelta) => {
			this.forest.applyDelta(changeDelta);
			this.events.emit("afterBatch");
		});
	}

	public locate(anchor: Anchor): AnchorNode | undefined {
		return this.forest.anchors.locate(anchor);
	}

	public get root(): UnwrappedEditableField {
		return this.context.unwrappedRoot;
	}

	public set root(data: ContextuallyTypedNodeData | undefined) {
		this.context.unwrappedRoot = data;
	}

	public fork(): ISharedTreeFork {
		const anchors = new AnchorSet();
		return new SharedTreeFork(
			this.createBranch(anchors),
			defaultChangeFamily,
			this.storedSchema.inner.clone(),
			this.forest.clone(this.storedSchema, anchors),
		);
	}

	/**
	 * TODO: Shared tree needs a pattern for handling non-changeset operations.
	 * Whatever pattern is adopted should probably also handle multiple versions of changeset operations.
	 * A single top level enum listing all ops (including their different versions),
	 * with at least fine grained enough detail to direct them to the correct subsystem would be a good approach.
	 * The current use-case (with an op applying to a specific index) is a temporary hack,
	 * and its not clear how it would fit into such a system if implemented in shared-tree-core:
	 * maybe op dispatch is part of the shared-tree level?
	 */
	protected override processCore(
		message: ISequencedDocumentMessage,
		local: boolean,
		localOpMetadata: unknown,
	) {
		if (!this.storedSchema.tryHandleOp(message)) {
			super.processCore(message, local, localOpMetadata);
		}
	}
}

/**
 * A channel factory that creates {@link ISharedTree}s.
 * @alpha
 */
export class SharedTreeFactory implements IChannelFactory {
	public type: string = "SharedTree";

	public attributes: IChannelAttributes = {
		type: this.type,
		snapshotFormatVersion: "0.0.0",
		packageVersion: "0.0.0",
	};

	public async load(
		runtime: IFluidDataStoreRuntime,
		id: string,
		services: IChannelServices,
		channelAttributes: Readonly<IChannelAttributes>,
	): Promise<ISharedTree> {
		const tree = new SharedTree(id, runtime, channelAttributes, "SharedTree");
		await tree.load(services);
		return tree;
	}

	public create(runtime: IFluidDataStoreRuntime, id: string): ISharedTree {
		const tree = new SharedTree(id, runtime, this.attributes, "SharedTree");
		tree.initializeLocal();
		return tree;
	}
}

class SharedTreeFork implements ISharedTreeFork {
	public readonly events = createEmitter<ViewEvents>();
	public readonly context: EditableTreeContext;

	public constructor(
		private readonly branch: SharedTreeBranch<DefaultEditBuilder, DefaultChangeset>,
		public readonly changeFamily: DefaultChangeFamily,
		public readonly storedSchema: InMemoryStoredSchemaRepository,
		public readonly forest: IEditableForest,
	) {
		this.context = getEditableTreeContext(forest, this.editor);
		branch.on("onChange", (change) => {
			const delta = this.changeFamily.intoDelta(change);
			this.forest.applyDelta(delta);
			this.events.emit("afterBatch");
		});
	}

	public get rootEvents(): ISubscribable<AnchorSetRootEvents> {
		return this.forest.anchors;
	}

	public get editor() {
		return this.branch.editor;
	}

	public readonly transaction: ISharedTreeView["transaction"] = {
		start: () => this.branch.startTransaction(new ForestRepairDataStore(() => this.forest)),
		commit: () => this.branch.commitTransaction(),
		abort: () => this.branch.abortTransaction(),
		inProgress: () => this.branch.isTransacting(),
	};

	public locate(anchor: Anchor): AnchorNode | undefined {
		return this.forest.anchors.locate(anchor);
	}

	public pull(): void {
		this.branch.pull();
	}

	public fork(): ISharedTreeFork {
		const storedSchema = this.storedSchema.clone();
		const anchors = new AnchorSet();
		return new SharedTreeFork(
			this.branch.fork(anchors),
			this.changeFamily,
			storedSchema,
			this.forest.clone(storedSchema, anchors),
		);
	}

	public merge(): void {
		this.branch.merge();
	}

	public isMerged(): boolean {
		return this.branch.isMerged();
	}

	public get root(): UnwrappedEditableField {
		return this.context.unwrappedRoot;
	}

	public set root(data: ContextuallyTypedNodeData | undefined) {
		this.context.unwrappedRoot = data;
	}
}

/**
 * Run a synchronous transaction on the given shared tree view.
 * This is a convenience helper around the {@link SharedTreeFork#transaction} APIs.
 * @param view - the view on which to run the transaction
 * @param transaction - the transaction function. This will be executed immediately. It is passed `view` as an argument for convenience.
 * If this function returns an `Abort` result then the transaction will be aborted. Otherwise, it will be committed.
 * @returns whether or not the transaction was committed or aborted
 * @alpha
 */
export function runSynchronous(
	view: ISharedTreeView,
	transaction: (view: ISharedTreeView) => TransactionResult | void,
): TransactionResult {
	view.transaction.start();
	const result = transaction(view);
	return result === TransactionResult.Abort
		? view.transaction.abort()
		: view.transaction.commit();
}
