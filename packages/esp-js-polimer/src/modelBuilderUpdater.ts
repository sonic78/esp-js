import {Router, Guard, isEspDecoratedObject, utils} from 'esp-js';
import {DevToolsConfig, DevToolsStateSelector, PolimerModel, PolimerModelConfig, StateHandlerModelMetadata} from './polimerModel';
import {ImmutableModel} from './immutableModel';
import {ModelPostEventProcessor, ModelPreEventProcessor} from './eventProcessors';
import {StateHandlerModel} from './stateHandlerModel';
import {StateHandlerConfiguration} from './stateEventHandlers';
import {EventTransformConfiguration} from './eventTransformations';
import {EventEnvelopePredicate} from './eventEnvelopePredicate';

export class PolimerModelBuilderUpdaterBase<TModel extends ImmutableModel> {
    protected _stateHandlerModelsConfig: Map<string, StateHandlerModelMetadata> = new Map();
    protected _stateHandlerConfig: Map<string, StateHandlerConfiguration[]> = new Map();
    protected _eventTransformConfig: EventTransformConfiguration[] = [];
    protected _devToolsConfig: DevToolsConfig<TModel>;

    /**
     * @deprecated use withStateHandlers()
     */
    withStateHandlerObject<TKey extends keyof TModel>(state: TKey, ...objectToScanForHandlers: any[]): this {
        return this.withStateHandlers(state, ...objectToScanForHandlers);
    }

    /**
     * Used to register handler objects against a state on the store.
     * @param state the state which will be passed to handlers as their draft
     * @param objectToScanForHandlers the objects containing @observeEvent decorated functions
     */
    withStateHandlers<TKey extends keyof TModel>(state: TKey, ...objectToScanForHandlers: object[]): this;
    /**
     * Used to register handler objects against a state on the store.
     * @param state the state which will be passed to handlers as their draft
     * @param deliveryPredicate - if provided, this predicated will be queried to see if the event should be dispatched to the handler
     * @param objectToScanForHandlers the objects containing @observeEvent decorated functions
     */
    withStateHandlers<TKey extends keyof TModel, TEvent = unknown>(state: TKey, deliveryPredicate: EventEnvelopePredicate<TModel, TEvent>, ...objectToScanForHandlers: object[]): this;
    withStateHandlers(...args: any[]): this {
        const state = args[0];
        let deliveryPredicate: EventEnvelopePredicate<TModel, unknown>;
        let configurations: StateHandlerConfiguration[];
        if (utils.isFunction(args[1])) {
            deliveryPredicate = args[1];
            configurations = args.slice(2).map(handler => ({deliveryPredicate: deliveryPredicate, stateHandler: handler}));
        } else {
            configurations = args.slice(1).map(handler => ({deliveryPredicate: undefined, stateHandler: handler}));
        }
        configurations.forEach((configuration: StateHandlerConfiguration) => {
            if (isEspDecoratedObject(configuration.stateHandler)) {
                let handlers = this._stateHandlerConfig.get(<string>state);
                if (!handlers) {
                    handlers = [];
                    this._stateHandlerConfig.set(<string>state, handlers);
                }
                handlers.push(configuration);
            } else {
                throw new Error(`Unknown observable object for state ${<string>state}. There was no esp decorator metadata on object passed to 'withObservablesOn(o)'`);
            }
        });
        return this;
    }

    /**
     * Used to register a legacy OO type model which can interact with esp-js-polimer models.
     *
     * Typically, this is only used if you have existing OO models which contain both state and event handlers, and you want that model to hang off your store.
     * @param state
     * @param stateHandlerModel
     * @param autoWireUpObservers: if true the given model will be wired up to the model (Router.observeEventsOn(model), this defaults to false as often the given instance may have specific initialisation and observe events itself.
     */
    withStateHandlerModel<TKey extends keyof TModel, TStateHandlerModel extends StateHandlerModel<TModel[TKey]>>(state: TKey, stateHandlerModel: TStateHandlerModel, autoWireUpObservers = false): this {
        this._stateHandlerModelsConfig.set(<string>state, {model: stateHandlerModel, autoWireUpObservers: autoWireUpObservers});
        return this;
    }

    /**
     * @deprecated used withEventTransforms (which is a compatible API).
     */
    withEventStreamsOn(...objectsWithEventTransforms: any[]): this {
        return this.withEventTransforms(...objectsWithEventTransforms);
    }

    /**
     * Scans the provided objectsWithEventTransforms for @eventTransformFor decorated functions, on build()/update() these will be wired up to the esp Router.
     * @param objectsWithEventTransforms objects containing the @eventTransformFor decorated functions
     */
    withEventTransforms(...objectsWithEventTransforms: any[]): this;
    /**
     * Scans the provided objectsWithEventTransforms for @eventTransformFor decorated functions, on build()/update() these will be wired up to the esp Router.
     * @param deliveryPredicate - if provided, this predicated will be queried before the event is dispatched to the transform
     * @param objectsWithEventTransforms - objects containing the @eventTransformFor decorated functions
     */
    withEventTransforms<TEvent = unknown>(deliveryPredicate: EventEnvelopePredicate<TModel, TEvent>, ...objectsWithEventTransforms: object[]): this;
    withEventTransforms(...args: any[]): this {
        let deliveryPredicate: EventEnvelopePredicate<TModel, unknown>;
        let objectsWithEventTransformsBeginAtIndex: number = 0;
        if (utils.isFunction(args[0])) {
            deliveryPredicate = args[0];
            objectsWithEventTransformsBeginAtIndex = 1;
        }
        const configurations: EventTransformConfiguration[] = args
            .slice(objectsWithEventTransformsBeginAtIndex)
            .map(objectWithEventTransforms => ({deliveryPredicate: deliveryPredicate, eventTransform: objectWithEventTransforms}));
        configurations.forEach((configuration: EventTransformConfiguration) => {
            if (isEspDecoratedObject(configuration.eventTransform)) {
                this._eventTransformConfig.push(configuration);
            } else {
                throw new Error(`Unknown event transformation object. There was no esp decorator metadata on object passed to 'withEventTransforms(...)'`);
            }
        });
        return this;
    }

    /**
     * Enables Redux dev tools support (if the extension is on the browser and it's enabled for esp-js via ?espReduxDevToolsEnabled).
     *
     */
    enableReduxDevTools(config: DevToolsConfig<TModel>): this {
        this._devToolsConfig = config;
        return this;
    }
}

export class PolimerModelBuilder<TModel extends ImmutableModel, TPersistedModelState = {}> extends PolimerModelBuilderUpdaterBase<TModel> {
    private _modelPreEventProcessor: ModelPreEventProcessor<TModel>;
    private _modelPostEventProcessor: ModelPostEventProcessor<TModel>;
    private _initialModel: TModel;
    private _stateSaveHandler: (model: TModel) => any;

    constructor(private _router: Router) {
        super();
    }

    /**
     * Set the initial, default, version of your store/model.
     *
     * Internally esp-js-polimer will manage this model using PolimerModel<TModel>.
     * PolimerModel<TModel>.getImmutableModel() will return the current version of this model.
     * @param model
     */
    withInitialModel(model: TModel): this {
        this._initialModel = model;
        return this;
    }

    /**
     * Register a hook which will the esp Router will invoke before it dispatches any events.
     * See ESP pre-event / post-event processor documentation.
     * @param modelPreEventProcessor
     */
    withPreEventProcessor(modelPreEventProcessor: ModelPreEventProcessor<TModel>): this {
        this._modelPreEventProcessor = modelPreEventProcessor;
        return this;
    }

    /**
     * Register a hook which will the esp Router will invoke after it dispatches any events.
     * See ESP pre-event / post-event processor documentation.
     * @param modelPreEventProcessor
     */
    withPostEventProcessor(modelPostEventProcessor: ModelPostEventProcessor<TModel>): this {
        this._modelPostEventProcessor = modelPostEventProcessor;
        return this;
    }

    /**
     * Adds a hook the PolimerModel<TModel> will invoke when it's time to save state.
     *
     * esp-js-polimer doesn't actually save the state, it will invoke this hook when PolimerModel<TModel>.getEspUiModelState() is called.
     * @param handler
     */
    withStateSaveHandler(handler: (model: TModel) => TPersistedModelState) {
        this._stateSaveHandler = handler;
        return this;
    }

    registerWithRouter(): PolimerModel<TModel> {
        Guard.isDefined(this._initialModel, 'Initial model is not set');
        Guard.stringIsNotEmpty(this._initialModel.modelId, `Initial model's modelId must not be null or empty`);
        Guard.isTruthy(this._stateHandlerConfig.size > 0 || this._stateHandlerModelsConfig.size > 0, `ERROR: No state handlers (maps, objects or models) setup for model with id ${this._initialModel.modelId}`);
        // The polimer model is a special case,
        // Some attributes may get bound to it dynamically.
        // Eor example the @viewBinding decorator.
        // Given that, we create a new constructor function to allow custom metadata to be added to this specific instance dynamically.
        let CustomPolimerModel = class extends PolimerModel<TModel> { };
        return new CustomPolimerModel(
            this._router,
            <PolimerModelConfig<TModel>>{
                initialModel: this._initialModel,
                stateHandlersConfig: this._stateHandlerConfig,
                stateHandlerModelsConfig: this._stateHandlerModelsConfig,
                eventTransformConfig: this._eventTransformConfig,
                modelPreEventProcessor: this._modelPreEventProcessor,
                modelPostEventProcessor: this._modelPostEventProcessor,
                stateSaveHandler: this._stateSaveHandler,
                devToolsConfig: this._devToolsConfig
            }
        );
    }
}

export class PolimerModelUpdater<TModel extends ImmutableModel> extends PolimerModelBuilderUpdaterBase<TModel> {
    protected _stateHandlersToRemove: object[] = [];
    protected _stateHandlerModelsToRemove: StateHandlerModel<any>[] = [];
    protected _objectsWithEventTransformsToRemove: object[] = [];

    constructor(private _router: Router, private _modelId: string) {
        super();
    }

    removeStateHandlers(...stateHandlers: object[]): this {
        this._stateHandlersToRemove.push(...stateHandlers);
        return this;
    }

    removeStateHandlerModel<TStateHandlerModel extends StateHandlerModel<any>>(...stateHandlerModel: TStateHandlerModel[]): this {
        this._stateHandlerModelsToRemove.push(...stateHandlerModel);
        return this;
    }

    removeEventTransforms(...objectsWithEventTransforms: any[]): this {
        this._objectsWithEventTransformsToRemove.push(...objectsWithEventTransforms);
        return this;
    }

    updateRegistrationsWithRouter(): PolimerModel<TModel> {
        Guard.isDefined(this._modelId, 'model ID to update is not set');
        Guard.isTruthy(this._router.isModelRegistered(this._modelId), `Model with id '${this._modelId}' is not registered with the router`);
        let polimerModel: PolimerModel<TModel> = this._router.getModel(this._modelId);
        polimerModel.update({
            itemsToWireUp: {
                stateHandlersConfig: this._stateHandlerConfig,
                stateHandlerModelsConfig: this._stateHandlerModelsConfig,
                eventTransformConfig: this._eventTransformConfig,
            },
            itemsToUnWire: {
                stateHandlers: this._stateHandlersToRemove,
                stateHandlerModels: this._stateHandlerModelsToRemove,
                eventTransforms: this._objectsWithEventTransformsToRemove,
            }
        });
        return polimerModel;
    }
}

declare module 'esp-js/.dist/typings/router/router' {
    export interface Router {
        modelBuilder?<TModel extends ImmutableModel, TPersistedModelState = {}>(): PolimerModelBuilder<TModel, TPersistedModelState>;

        modelUpdater?<TModel extends ImmutableModel>(existingModelId: string): PolimerModelUpdater<TModel>;
    }
}

Router.prototype.modelBuilder = function <TModel extends ImmutableModel>(): PolimerModelBuilder<TModel> {
    let router = this;
    return new PolimerModelBuilder(router);
};

Router.prototype.modelUpdater = function <TModel extends ImmutableModel>(existingModelId: string): PolimerModelUpdater<TModel> {
    let router = this;
    return new PolimerModelUpdater(router, existingModelId);
};
