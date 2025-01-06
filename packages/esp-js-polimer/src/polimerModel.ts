import {PolimerEventHandler} from './stateEventHandlers';
import {connectReduxDevTools, sendUpdateToReduxDevTools, reduxDevToolsDetectedAndEnabledInEsp} from 'esp-js';
import {CompositeDisposable, DefaultModelAddress, DisposableBase, EspDecoratorUtil, EventEnvelope, EventObservationMetadata, Guard, Level, ObservationStage, observeEvent, PolimerEventPredicate, Router} from 'esp-js';
import {EventTransformConfiguration, InputEvent, OutputEvent} from './eventTransformations';
import {logger} from './logger';
import {ImmutableModel} from './immutableModel';
import {PolimerEvents} from './polimerEvents';
import {produce} from 'immer';
import {StateHandlerModel} from './stateHandlerModel';
import {ModelPostEventProcessor, ModelPreEventProcessor} from './eventProcessors';
import {merge, Observable, Subscriber} from 'rxjs';
import {filter} from 'rxjs/operators';
import {Disposable, utils} from 'esp-js';
import {StateHandlerConfiguration} from './stateEventHandlers';
import {StateReaderWriter, MapReaderWriter, DirectStateReaderWriter} from './stateReaderWriter';
import {EventEnvelopePredicate} from './eventEnvelopePredicate';
import {createImmutableModelUtility, ImmutableModelUtility} from './immutableModelUtility';

export type DevToolsStateSelector<TModel extends ImmutableModel> = (model: TModel) => object;

export interface DevToolsConfig<TModel extends ImmutableModel> {
    /**
     * A list of events which won't be forwarded to dev tools.
     * This is useful for noisy events which ultimately slow dev tools.
     */
    ignoredEvents: string[];
    /**
     * A mapper to create state to send to dev tools.
     * For smaller models you can return the given model sent to the mapper,
     * for larger models you need to map to a smaller structure to void killing dev tools.
     * You can also return 'null/undefined' to send no sate (just the event will be sent).
     */
    devToolsStateSelector: DevToolsStateSelector<TModel>;
}

export interface PolimerModelConfig<TModel extends ImmutableModel> {
    initialModel: TModel;
    modelPreEventProcessor: ModelPreEventProcessor<TModel>;
    modelPostEventProcessor: ModelPostEventProcessor<TModel>;
    stateSaveHandler: (model: TModel) => any;
    stateHandlerModelsConfig: Map<string, StateHandlerModelMetadata>;
    stateHandlersConfig: Map<string, StateHandlerConfiguration[]>;
    eventTransformConfig: EventTransformConfiguration[];
    devToolsConfig: DevToolsConfig<TModel>;
}

export interface PolimerModelConfigUpdate {
    itemsToWireUp?: {
        stateHandlersConfig: Map<string, StateHandlerConfiguration[]>;
        stateHandlerModelsConfig: Map<string, StateHandlerModelMetadata>;
        eventTransformConfig: EventTransformConfiguration[];
    };
    itemsToUnWire?: {
        stateHandlers: object[];
        stateHandlerModels: StateHandlerModel<any>[];
        eventTransforms: object[];
    };
}

export interface StateHandlerModelMetadata {
    // a non-polimer OO type model
    model: StateHandlerModel<any>;
    autoWireUpObservers: boolean;
}

interface ModelHandlerMetadata<TModel> {
    stateName: string;
    // a non-polimer OO type model
    model: StateHandlerModel<TModel>;
}

export class PolimerModel<TModel extends ImmutableModel> extends DisposableBase {
    private readonly _modelEventHandlersByEventName: Map<string, ModelHandlerMetadata<TModel>[]> = new Map();
    private _disposablesKeyedOnObjectScannedAtWireup: Map<object, Disposable> = new Map();
    private _activeStateHandlerModels: { stateName: keyof TModel; model: StateHandlerModel<any> }[] = [];
    private _immutableModelUtility: ImmutableModelUtility<TModel>;
    private _modelPreEventProcessor: ModelPreEventProcessor<TModel>;
    private _modelPostEventProcessor: ModelPostEventProcessor<TModel>;
    private readonly _modelId: string;
    private _stateSaveHandler: (model: TModel) => any;
    private _devToolsConfig: DevToolsConfig<TModel>;

    constructor(private readonly _router: Router, initialConfig: PolimerModelConfig<TModel>) {
        super();
        Guard.isDefined(_router, 'router must be defined');
        Guard.isDefined(initialConfig, 'initialConfig must be defined');
        Guard.isObject(initialConfig.initialModel, 'initialConfig.initialModel must be defined');
        Guard.stringIsNotEmpty(initialConfig.initialModel.modelId, `initialConfig.initialModel.modelId must not be null or empty`);
        this._modelId = initialConfig.initialModel.modelId;
        this._immutableModelUtility = createImmutableModelUtility(this.modelId, initialConfig.initialModel);
        this._stateSaveHandler = initialConfig.stateSaveHandler;
        if (initialConfig.modelPreEventProcessor) {
            Guard.isFunction(initialConfig.modelPreEventProcessor, 'The initialConfig.modelPreEventProcessor is not a function');
            this._modelPreEventProcessor = initialConfig.modelPreEventProcessor;
        }
        if (initialConfig.modelPostEventProcessor) {
            Guard.isFunction(initialConfig.modelPostEventProcessor, 'The initialConfig.modelPostEventProcessor is not a function');
            this._modelPostEventProcessor = initialConfig.modelPostEventProcessor;
        }
        this._router.addModel(this._modelId, this);
        this._wireUpStateHandlerModels(initialConfig.stateHandlerModelsConfig);
        this._wireUpStateHandlers(initialConfig.stateHandlersConfig);
        this._wireUpEventTransforms(initialConfig.eventTransformConfig);
        this.addDisposable(this._router.observeEventsOn(this._modelId, this));
        this._setDevToolsConfig(initialConfig.devToolsConfig);
    }

    public get modelId() {
        return this._modelId;
    }

    public update = (config: PolimerModelConfigUpdate) => {
        if (config.itemsToUnWire) {
            const itemsToUnwire: any[] = [];
            if (config.itemsToUnWire.eventTransforms) {
                itemsToUnwire.push(...config.itemsToUnWire.eventTransforms);
            }
            if (config.itemsToUnWire.stateHandlerModels) {
                itemsToUnwire.push(...config.itemsToUnWire.stateHandlerModels);
            }
            if (config.itemsToUnWire.stateHandlers) {
                itemsToUnwire.push(...config.itemsToUnWire.stateHandlers);
            }
            itemsToUnwire.forEach(obg => {
                let disposables = this._disposablesKeyedOnObjectScannedAtWireup.get(obg);
                if (disposables) {
                    this._disposablesKeyedOnObjectScannedAtWireup.delete(obg);
                    this.removeDisposable(disposables);
                    disposables.dispose();
                } else {
                    logger.warn(`Object passed to un-wire not currently wired up. Are you passing the correct state handler or event transformation handler to deregister?`);
                }
            });
        }
        if (config.itemsToWireUp) {
            this._wireUpStateHandlerModels(config.itemsToWireUp?.stateHandlerModelsConfig);
            this._wireUpStateHandlers(config.itemsToWireUp?.stateHandlersConfig);
            this._wireUpEventTransforms(config.itemsToWireUp?.eventTransformConfig);
        }
    };

    preProcess() {
        this._immutableModelUtility.beginMutation();
        if (this._modelPreEventProcessor) {
            const newModel = this._modelPreEventProcessor(this._immutableModelUtility.model);
            // has the entire model been replaced by the processor?
            if (newModel) {
                this._immutableModelUtility.replaceModel(newModel);
            }
        }

        // run pre-processing for the OO/legacy type models which may be integrating with polimer models
        this._activeStateHandlerModels.forEach(({model, stateName}) => {
            if (model.preProcess) {
                model.preProcess(model);
                this._immutableModelUtility.model[stateName] = model.getEspPolimerState();
            }
        });
    }

    postProcess(eventsProcessed: string[]) {
        if (this._modelPostEventProcessor) {
            const newModel = this._modelPostEventProcessor(this._immutableModelUtility.model, eventsProcessed);
            // has the model been replaced by the processor?
            if (newModel) {
                this._immutableModelUtility.replaceModel(newModel);
            }
        }
        // run post-processing for the OO/legacy type models which may be integrating with polimer models
        this._activeStateHandlerModels.forEach(({model, stateName}) => {
            if (model.postProcess) {
                model.postProcess(model, eventsProcessed);
                const nextState = model.getEspPolimerState();
                this._immutableModelUtility.model[stateName] = nextState;
            }
        });
        this._immutableModelUtility.endMutation();
    }

    /**
     * This is a hook to provide interop with esp-js-ui.
     * Polimer doesn't have a hard dependency on esp-js-ui, however if your models are created using esp-js-ui then this hook will be used to save state.
     *
     * */
    public getEspUiModelState = (): any => {
        if (!this._stateSaveHandler) {
            return null;
        }
        return this._stateSaveHandler(this._immutableModelUtility.model);
    };

    /**
     * @deprecated
     * Previously this returns a non changing instance, hence it now points to getEspPolimerImmutableModelProxy().
     */
    public getImmutableModel = (): TModel => {
        return this.getEspPolimerImmutableModelProxy();
    };

    /**
     * Returns a Proxy which always backs onto the latest PolimerModel.getEspPolimerImmutableModel();
     * The returned Proxy instance won't chant.
     */
    getEspPolimerImmutableModelProxy() {
        return this._immutableModelUtility.modelProxy;
    }

    /**
     * Returns the latest model state.
     * This instance will change when the esp Router has finished processing events against this model.
     */
    getEspPolimerImmutableModel() {
        return this._immutableModelUtility.model;
    }

    // called by the router when it's finished dispatching an event
    public eventDispatched(eventType: string, event: any, stage: ObservationStage) {
        if (stage !== ObservationStage.final) {
            return;
        }
        let handlers = this._modelEventHandlersByEventName.get(eventType);
        if (handlers) {
            handlers.forEach((modelHandlerMetadata: ModelHandlerMetadata<TModel>) => {
                // Given an event processed by the model in question has just finished, we replace the relevant state on the immutable model
                (<any>this._immutableModelUtility.model[modelHandlerMetadata.stateName]) = modelHandlerMetadata.model.getEspPolimerState();
            });
        }
        this._trySendDevToolsUpdate(eventType, event);
    }

    @observeEvent(PolimerEvents.disposeModel)
    public dispose() {
        logger.debug(`Disposing PolimerModel<> ${this._modelId}`);
        this._router.removeModel(this.modelId);
        this._disposablesKeyedOnObjectScannedAtWireup.forEach(d => (d.dispose()));
        super.dispose();
    }

    private _wireUpStateHandlerModels(stateHandlerModelsConfig: Map<string, StateHandlerModelMetadata>) {
        if (!stateHandlerModelsConfig) {
            return;
        }
        stateHandlerModelsConfig.forEach((metadata: StateHandlerModelMetadata, stateName: string) => {
            const modelDisposables = this._getDisposableForObject(metadata.model);
            const activeStateHandlerModel = {stateName: stateName, model: metadata.model};
            this._activeStateHandlerModels.push(activeStateHandlerModel);
            modelDisposables.add(() => {
                this._activeStateHandlerModels.splice(this._activeStateHandlerModels.indexOf(activeStateHandlerModel), 1);
            });
            if (metadata.autoWireUpObservers) {
                modelDisposables.add(this._router.observeEventsOn(this._modelId, metadata.model));
            }
            let events: EventObservationMetadata[] = EspDecoratorUtil.getAllEvents(metadata.model);
            events.forEach((eventObservationMetadata: EventObservationMetadata) => {
                let modelEventHandlers = this._modelEventHandlersByEventName.get(eventObservationMetadata.eventType);
                if (!modelEventHandlers) {
                    modelEventHandlers = [];
                    this._modelEventHandlersByEventName.set(eventObservationMetadata.eventType, modelEventHandlers);
                }
                let registration = {stateName: stateName, model: metadata.model};
                modelEventHandlers.push(registration);
                modelDisposables.add(() => {
                    modelEventHandlers.splice(modelEventHandlers.indexOf(registration), 1);
                });
            });
        });
    }

    private _wireUpStateHandlers(stateHandlersConfig: Map<string, StateHandlerConfiguration[]>) {
        if (!stateHandlersConfig) {
            return;
        }
        stateHandlersConfig.forEach((stateHandlerConfigurations: StateHandlerConfiguration[], stateName) => {
            stateHandlerConfigurations.forEach(({stateHandler, deliveryPredicate}) => {
                const handlerDisposables = this._getDisposableForObject(stateHandler);
                // create a new handler map which has the eventType as the key
                // we could just omit the decorator and just use function names, but there can be more than one decorator on a function
                const events: EventObservationMetadata[] = EspDecoratorUtil.getAllEvents(stateHandler);
                events.forEach((decoratorMetadata: EventObservationMetadata) => {
                    // A note on the produce() overload we use, from https://github.com/mweststrate/immer:
                    //
                    // Passing a function as the first argument to produce is intended to be used for currying.
                    // This means that you get a pre-bound producer that only needs a state to produce the value from.
                    // The producer function gets passed in the draft, and any further arguments that were passed to the curried function.
                    const handler = produce(
                        stateHandler[decoratorMetadata.functionName].bind(stateHandler) as PolimerEventHandler<any, any, any> // explict/documentation only cast
                    );
                    // predicate which may have been set when registering the handler
                    const eventIsForThisSpecificHandlerPredicate = deliveryPredicate
                        ? (ee: EventEnvelope<any, any>) => deliveryPredicate(ee)
                        : () => true; // no deliveryPredicate specified so accept it always
                    // predicate which may exist via an @observeEvent decorator
                    const eventObservationPredicate = <PolimerEventPredicate>decoratorMetadata.predicate;
                    // If the dispatched event has an entityKey, and the state relating to 'stateName' is of type Map, then we will update a piece of state in that map.
                    // This will allow for more focused handlers that just receive an entity type rather than the entire Map.
                    // stateReaderWriter will hide away the logic to access the specific state we need.
                    // Here we create a function to get a reader/write based on a potential entityKey;
                    const getStateReaderWriter: (entityKey: string) => StateReaderWriter = this._createStateReaderWriter(stateName);
                    handlerDisposables.add(
                        this._router
                            .getEventObservable(this._modelId, decoratorMetadata.eventType, decoratorMetadata.observationStage)
                            .filter(eventEnvelope => eventIsForThisSpecificHandlerPredicate(eventEnvelope))
                            .subscribe((eventEnvelope: EventEnvelope<any, any>) => {
                                const model = <any>this._immutableModelUtility.model;
                                let stateReaderWriter: StateReaderWriter = getStateReaderWriter(eventEnvelope.entityKey);
                                const beforeState = stateReaderWriter.getState(eventEnvelope.entityKey);
                                let processEvent = true;
                                if (eventObservationPredicate) {
                                    let notYetCanceled = eventEnvelope.context.isCanceled === false;
                                    let notYetCommitted = eventEnvelope.context.isCommitted === false;
                                    processEvent = eventObservationPredicate(beforeState, eventEnvelope.event, model, eventEnvelope.context);
                                    if (notYetCanceled && eventEnvelope.context.isCanceled) {
                                        throw new Error('You can\'t cancel an event in an event filter/predicate. Event: [' + eventEnvelope.eventType + '], ModelId: [' + eventEnvelope.modelId + ']');
                                    }
                                    if (notYetCommitted && eventEnvelope.context.isCommitted) {
                                        throw new Error('You can\'t commit an event in an event filter/predicate. Event: [' + eventEnvelope.eventType + '], ModelId: [' + eventEnvelope.modelId + ']');
                                    }
                                }
                                if (processEvent) {
                                    if (logger.isLevelEnabled(Level.verbose)) {
                                        logger.verbose(`State [${stateName}], eventType [${eventEnvelope.eventType}]: invoking a reducer. Before state logged to console.`, beforeState);
                                    }
                                    const afterState = handler(beforeState, eventEnvelope.event, model, eventEnvelope.context);
                                    if (logger.isLevelEnabled(Level.verbose)) {
                                        logger.verbose(`State [${stateName}], eventType [${eventEnvelope.eventType}]: reducer invoked. After state logged to console.`, afterState);
                                    }
                                    stateReaderWriter.setState(eventEnvelope.entityKey, afterState);
                                } else {
                                    if (logger.isLevelEnabled(Level.verbose)) {
                                        logger.verbose(`Received "${eventEnvelope.eventType}" for "${stateName}" state, skipping as the handlers predicate returned false`, beforeState);
                                    }
                                }
                            })
                    );
                });
            });
        });
    }

    private _wireUpEventTransforms = (eventTransformConfig: EventTransformConfiguration[]) => {
        if (!eventTransformConfig) {
            return;
        }
        eventTransformConfig.forEach(({deliveryPredicate, eventTransform}: EventTransformConfiguration) => {
            const metadata: EventObservationMetadata[] = EspDecoratorUtil.getAllEvents(eventTransform);
            const transformDisposables = this._getDisposableForObject(eventTransform);
            // group by the function name as there may be multiple events being observed by 1 function
            let metadataGroupedByFunction: { [functionName: string]: EventObservationMetadata[] } = metadata.reduce(
                (result, m) => {
                    (result[m.functionName] = result[m.functionName] || []).push(m);
                    return result;
                },
                {}
            );
            Object.keys(metadataGroupedByFunction).forEach(functionName => {
                const metadataForFunction: EventObservationMetadata[] = metadataGroupedByFunction[functionName];
                // When using decorators, the function may declare multiple decorators,
                // they may use a different observation stage. Given that, we subscribe to the router separately
                // and pump the final observable into our handling function to subscribe to.
                const inputEventStream = merge(
                    ...metadataForFunction.map(
                        m => this._observeEvent(m.eventType, m.observationStage, m.functionName, deliveryPredicate)
                    )
                );
                const outputEventStream = eventTransform[functionName](inputEventStream);
                transformDisposables.add(
                    outputEventStream
                        .pipe(
                            filter(output => output != null)
                        )
                        .subscribe(
                            (outputEvent: OutputEvent<any>) => {
                                if (outputEvent.broadcast) {
                                    if (logger.isLevelEnabled(Level.verbose)) {
                                        logger.verbose('Received a broadcast event from observable. Dispatching to esp-js router.', outputEvent);
                                    }
                                    this._router.broadcastEvent(outputEvent.eventType, outputEvent.event || {});
                                } else {
                                    // To figure out which model ID we're publishing to, we have to deal with a few cases.
                                    // This is due to:
                                    // 1) backwards compatability (check for the deprecated .modelId property),
                                    // 2) allowing for address to be a string, or ModelAddress
                                    // 3) allowing for the output event to omit the model ID in the above 2 cases, whereby we need to default it to this._modelId.
                                    let modelAddress: DefaultModelAddress;
                                    if (utils.isString(outputEvent.modelId)) {
                                        // send using modelId STRING
                                        modelAddress = new DefaultModelAddress(outputEvent.modelId);
                                    } else if (utils.isString(outputEvent.address)) {
                                        // again send using modelId STRING, taken from address
                                        modelAddress = new DefaultModelAddress(outputEvent.address);
                                    } else if (utils.isObject(outputEvent.address)) {
                                        const modelId = outputEvent.address.modelId || this._modelId;
                                        modelAddress = new DefaultModelAddress(modelId, outputEvent.address.entityKey);
                                    } else {
                                        // else nothing was specified, default the current model's ID
                                        modelAddress = new DefaultModelAddress(this._modelId);
                                    }
                                    if (logger.isLevelEnabled(Level.verbose)) {
                                        logger.verbose(`Received eventType ${outputEvent.eventType} for [${modelAddress.toString()}]. Dispatching to esp-js router.`, outputEvent);
                                    }
                                    try {
                                        this._router.publishEvent(modelAddress, outputEvent.eventType, outputEvent.event);
                                    } catch (e) {
                                        logger.error(`Error publishing an event tranasforms output event`, e);
                                        throw e;
                                    }
                                }
                            },
                            (err: any) => {
                                logger.error(`Error on observable stream for model ${this.modelId}.`, err);
                            }
                        )
                );
            });
        });
    };

    private _observeEvent = (eventType: string, observationStage: ObservationStage, functionName: string, deliveryPredicate: EventEnvelopePredicate<any, any>): Observable<InputEvent<TModel, any>> => {
        return new Observable((obs: Subscriber<any>) => {
                if (logger.isLevelEnabled(Level.verbose)) {
                    logger.verbose(`Event transform: wire-up on function [${functionName}] for event [${eventType}] at stage [${observationStage}] for model [${this._modelId}] `);
                }
                const eventIsForThisSpecificHandlerPredicate = deliveryPredicate
                    ? (ee: EventEnvelope<any, any>) => deliveryPredicate(ee)
                    : () => true; // no deliveryPredicate specified so accept it always
                const espEventStreamSubscription = this._router
                    .getEventObservable(this._modelId, eventType, observationStage)
                    .filter(ee => eventIsForThisSpecificHandlerPredicate(ee))
                    .subscribe(
                        (eventEnvelope: EventEnvelope<any, PolimerModel<TModel>>) => {
                            if (logger.isLevelEnabled(Level.verbose)) {
                                logger.verbose(`Event transform: event [${eventEnvelope.eventType}] received at stage [${eventEnvelope.observationStage}] for model [${eventEnvelope.modelId}].`);
                            }
                            let inputEvent: InputEvent<TModel, any> = this._mapEventEnvelopToInputEvent(eventEnvelope);
                            // Pass the event off to our polimer observable stream.
                            // In theory, these streams must never error.
                            // They need to bake in their own exception handling.
                            // We wrap in a try catch just to stop any exception bubbling to the router
                            try {
                                obs.next(inputEvent);
                            } catch (err) {
                                logger.error(`Error caught on event observable stream for event ${eventType}.`, err);
                                throw err;
                            }
                        },
                        () => {
                            if (logger.isLevelEnabled(Level.verbose)) {
                                logger.verbose(`Event transform: stream for function [${functionName}] event [${eventType}] stage [${observationStage}] model [${this._modelId}] completed`);
                            }
                            obs.complete();
                        }
                    );
                return () => {
                    espEventStreamSubscription.dispose();
                };
            }
        );
    };

    private _mapEventEnvelopToInputEvent(eventEnvelope: EventEnvelope<any, PolimerModel<TModel>>): InputEvent<TModel, any> {
        const modelProxy: TModel = eventEnvelope.model.getEspPolimerImmutableModelProxy();
        return <InputEvent<TModel, any>>{
            event: eventEnvelope.event,
            eventType: eventEnvelope.eventType,
            model: modelProxy,
            context: eventEnvelope.context
        };
    }

    private _getDisposableForObject = (trackedObject: any) => {
        Guard.isFalsey(this._disposablesKeyedOnObjectScannedAtWireup.has(trackedObject), 'Object already registered. Using the same object instance for multiple esp-js-polimer registrations (be it state handlers or event transforms) is not supported.');
        const instanceDisposables = new CompositeDisposable();
        this.addDisposable(instanceDisposables);
        // We key the disposable against the object instance.
        // We do this as handlers/models/event-streams can share a different lifecycle to the parent PolimerModel.
        // I.e. in a call to polimerModel.update(config) handlers/models/streams can be added or removed, when that happens, we'll just add or dispose of the specific instanceDisposables.
        this._disposablesKeyedOnObjectScannedAtWireup.set(trackedObject, instanceDisposables);
        return instanceDisposables;
    };

    private _createStateReaderWriter = (stateName: string): (entityKey: string) => StateReaderWriter => {
        // If the state is of type Map, we need to have special logic to process events targeted to that state.
        // While we can know at event subscription if the state on the model is a Map, we don't know if an event will want to target an item in the map, or the entire map.
        // Which of the two will be known if the event is published with an 'entityKey', which is an addressing property the esp router supports.
        // At this point, we can create an API which works with both cases.
        const stateTypeIsMap = this._immutableModelUtility.model[stateName] instanceof Map;
        const mapReaderWriter: StateReaderWriter = stateTypeIsMap
            ? new MapReaderWriter(() => this._immutableModelUtility.model, stateName)
            : undefined;
        const directStateReaderWriter: StateReaderWriter = new DirectStateReaderWriter(() => this._immutableModelUtility.model, stateName);
        return (entityKey: string) => {
            return stateTypeIsMap && utils.isString(entityKey)
                ? mapReaderWriter
                : directStateReaderWriter;
        };
    };

    private _setDevToolsConfig(devToolsConfig: DevToolsConfig<TModel>) {
        if (!devToolsConfig) {
            return;
        }
        Guard.isFunction(devToolsConfig.devToolsStateSelector, `DevTools enabled for ${this._modelId}, however [${devToolsConfig.devToolsStateSelector}] is not set or not a function`);
        this._devToolsConfig = {
            ignoredEvents: devToolsConfig.ignoredEvents || [],
            devToolsStateSelector: devToolsConfig.devToolsStateSelector,
        };
        const unsubscribe = connectReduxDevTools(this._modelId);
        this.addDisposable(() => {
            unsubscribe();
        });
        this._trySendDevToolsUpdate('@@INIT', null);
    }

    private _trySendDevToolsUpdate = (eventType: string, event: any) => {
        if (!this._devToolsConfig) {
            return;
        }
        if (!reduxDevToolsDetectedAndEnabledInEsp()) {
            return;
        }
        if (this._devToolsConfig.ignoredEvents.includes(eventType)) {
            return;
        }
        let state = this._devToolsConfig.devToolsStateSelector(this._immutableModelUtility.model);
        sendUpdateToReduxDevTools(
            {eventType: eventType, event: event},
            state,
            this._modelId
        );
    };
}

export namespace PolimerModel {
    export const isPolimerModel = (obj: any): obj is PolimerModel<any> => {
        return 'getEspPolimerImmutableModel' in obj;
    };
}