// notice_start
/*
 * Copyright 2015 Dev Shop Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// notice_end

import {DefaultModelAddress, ModelAddress, EventContext, EventRecord, ModelRecord, ObservationStage, SingleModelRouter, State, Status} from './';
import {Observable, RouterObservable, RouterSubject, Subject} from '../reactive';
import {Guard, Health, HealthIndicator, Logger, utils} from '../system';
import {CompositeDisposable, Disposable, DisposableBase} from '../system/disposables';
import {EspDecoratorUtil, ObserveEventPredicate} from '../decorators';
import {DecoratorObservationRegister} from './decoratorObservationRegister';
import {EventProcessors} from './eventProcessors';
import {DispatchType, EventEnvelope, ModelEnvelope} from './envelopes';
import {EventStreamsRegistration} from './modelRecord';
import {DefaultEventContext} from './eventContext';
import {DecoratorTypes} from '../decorators';
import {ReduxDevToolsDiagnosticMonitor, NoopDiagnosticMonitor, DiagnosticMonitor, reduxDevToolsDetectedAndEnabledInEsp} from './devtools';

let _log = Logger.create('Router');

type Envelope = ModelEnvelope<any> | EventEnvelope<any, any>;

const RUN_ACTION_EVENT_NAME = '__runAction';

let routerInstanceId = 1;

export class Router extends DisposableBase implements HealthIndicator {
    private _models: Map<string, ModelRecord>;
    private _dispatchSubject: Subject<Envelope>;
    private _haltingException: Error;
    private _state: State;
    private _onErrorHandlers: Array<(error: Error) => void>;
    private _diagnosticMonitor: DiagnosticMonitor;
    private _decoratorObservationRegister: DecoratorObservationRegister;
    private _currentHealth = Health.builder(this.healthIndicatorName).isHealthy().build();

    public constructor() {
        super();
        this._models = new Map();
        this._haltingException = undefined;
        this._dispatchSubject = new Subject<Envelope>();
        this._onErrorHandlers = [];

        this._state = new State();

        this._decoratorObservationRegister = new DecoratorObservationRegister();

        this._diagnosticMonitor = reduxDevToolsDetectedAndEnabledInEsp()
            ? new ReduxDevToolsDiagnosticMonitor(`Router_${Date.now()}`)
            : new NoopDiagnosticMonitor();
        this.addDisposable(this._diagnosticMonitor);
    }

    public get currentStatus(): Status {
        return this._state.currentStatus;
    }

    public get healthIndicatorName(): string {
        return 'Router';
    }

    public health(): Health {
        return this._currentHealth;
    }

    public addModel(modelId: string, model: any, eventProcessors?: EventProcessors) {
        this._throwIfHaltedOrDisposed();
        Guard.isString(modelId, 'The modelId argument should be a string');
        Guard.isDefined(model, 'The model argument must be defined');
        if (eventProcessors) {
            Guard.isObject(eventProcessors, `The eventProcessors argument provided with the model (of id ${modelId}) should be an object`);
        }
        let modelRecord = this._models.get(modelId);
        if (modelRecord) {
            // It's possible the model was observed first, thus has a model record but not yet an actual model.
            // If there is a record, we just ensure it's model isn't there yet.
            Guard.isFalsey(modelRecord.model, 'The model with id [' + modelId + '] is already registered');
        }
        this._getOrCreateModelRecord(modelId, model, eventProcessors);
        this._dispatchSubject.onNext({modelId: modelId, model: model, dispatchType: DispatchType.ModelUpdate});
        this._diagnosticMonitor.addModel(modelId);
    }

    public removeModel(modelId: string) {
        Guard.isString(modelId, 'The modelId argument should be a string');
        let modelRecord = this._models.get(modelId);
        if (modelRecord) {
            this._diagnosticMonitor.removeModel(modelId);
            modelRecord.wasRemoved = true;
            this._models.delete(modelId);
            modelRecord.dispose();
            this._dispatchSubject.onNext({modelId: modelId, model: undefined, dispatchType: DispatchType.ModelDelete});
        }
    }

    public isModelRegistered(modelId: string): boolean {
        Guard.isString(modelId, 'The modelId argument should be a string');
        return this._models.has(modelId);
    }

    public isModelDispatchStatus(modelId: string, status: Status): boolean {
        return this._state.currentModelRecord?.modelId === modelId && this._state.currentStatus === status;
    }

    /**
     * Exists for read only access to a model.
     *
     * Note: given this is JavaScript, it's up to the caller to not write against the model.
     * If you want to modify the model, publish an event to it.
     *
     * @param modelId
     */
    public getModel<TModel = object>(modelId: string): TModel {
        Guard.isString(modelId, 'The modelId argument should be a string');
        if (this._models.get(modelId)) {
            let modelRecord = this._models.get(modelId);
            if (!modelRecord.hasModel) {
                throw new Error(`Model with id ${modelId} is registered, however it's model has not yet been set. Can not retrieve`);
            }
            return modelRecord.model;
        }
        return null;
    }

    /**
     * Exists to find a model for read only access.
     *
     * Note: given this is JavaScript, it's up to the caller to not write against the model.
     * If you want to modify the model, publish an event to it.
     *
     * Returns the found model else null.
     *
     * @param predicate = a predicate which is used as a test against each model. Will stop on first match
     */
    public findModel(predicate: (model: any) => boolean) {
        Guard.isFunction(predicate, 'predicate should be a function');
        for (let [key, value] of this._models) {
            if (value.hasModel) {
                if (predicate(value.model)) {
                    return value.model;
                }
            }
        }
        return null;
    }

    public publishEvent(modelId: string, eventType: string, event: any) : void;
    public publishEvent(modelAddress: ModelAddress, eventType: string, event: any)  : void;
    public publishEvent(...args: any[]): void {
        this._throwIfHaltedOrDisposed();
        const modelAddress: ModelAddress = utils.isObject(args[0]) && args[0] instanceof DefaultModelAddress
            ? args[0]
            : new DefaultModelAddress(args[0]);
        const eventType = args[1];
        const event = args[2];
        Guard.isString(eventType, 'The eventType argument should be a string');
        Guard.isDefined(event, 'The event argument must be defined');
        if (this._state.currentStatus === Status.EventExecution) {
            throw new Error('You can not publish further events when performing an event execution. modelAddress: [' + modelAddress + '], eventType:[' + eventType + ']');
        }
        this._diagnosticMonitor.publishEvent(modelAddress, eventType, event);
        this._tryEnqueueEvent(modelAddress, eventType, event);
    }

    public broadcastEvent(eventType: string, event: any) {
        Guard.isString(eventType, 'The eventType argument should be a string');
        Guard.isDefined(event, 'The event argument should be defined');
        this._diagnosticMonitor.broadcastEvent(eventType);
        for (let [key, value] of this._models) {
            this._tryEnqueueEvent(new DefaultModelAddress(value.modelId), eventType, event);
        }
        try {
            this._purgeEventQueues();
        } catch (err) {
            this._halt(err);
        }
    }

    public executeEvent(eventType: string, event: any) {
        this._throwIfHaltedOrDisposed();
        Guard.isString(eventType, 'The eventType argument should be a string');
        Guard.isDefined(event, 'The event argument should be defined');
        this._diagnosticMonitor.executingEvent(eventType);
        this._state.executeEvent(() => {
            this._dispatchEventToEventProcessors(
                this._state.currentModelRecord,
                null,
                event,
                eventType
            );
        });
    }

    public runAction<TModel>(modelId: string, action: (model: TModel) => void) {
        this._throwIfHaltedOrDisposed();
        Guard.isString(modelId, 'modelId must be a string');
        Guard.isTruthy(modelId !== '', 'modelId must not be empty');
        Guard.isFunction(action, 'the argument passed to runAction must be a function and can not be null|undefined');
        this._diagnosticMonitor.runAction(modelId);
        let modelRecord = this._models.get(modelId);
        if (!modelRecord) {
            throw new Error('Can not run action as model with id [' + modelId + '] not registered');
        } else {
            modelRecord.eventQueue.push({eventType: RUN_ACTION_EVENT_NAME, entityKey: null, event: null, action: action});
            try {
                this._purgeEventQueues();
            } catch (err) {
                this._halt(err);
            }
        }
    }

    public getEventObservable<TEvent, TModel>(modelId: string, eventType: string, stage?: ObservationStage): Observable<EventEnvelope<TEvent, TModel>> {
        return Observable.create<EventEnvelope<TEvent, TModel>>(o => {
            this._throwIfHaltedOrDisposed();
            Guard.isString(modelId, 'The modelId argument should be a string');
            Guard.isString(eventType, 'The eventType must be a string');
            Guard.isDefined(modelId, 'The modelId argument should be defined');
            stage = this._tryDefaultObservationStage(stage);
            let modelRecord = this._getOrCreateModelRecord(modelId);
            let eventStreamDetails: EventStreamsRegistration = modelRecord.getOrCreateEventStreamsRegistration(
                eventType,
                <Observable<EventEnvelope<any, any>>>this._dispatchSubject
            );
            switch (stage) {
                case ObservationStage.preview:
                    return eventStreamDetails.preview.subscribe(o);
                case ObservationStage.normal:
                    return eventStreamDetails.normal.subscribe(o);
                case ObservationStage.committed:
                    return eventStreamDetails.committed.subscribe(o);
                case ObservationStage.final:
                    return eventStreamDetails.final.subscribe(o);
                case ObservationStage.all:
                    return eventStreamDetails.all.subscribe(o);
                default:
                    throw new Error(`Unknown stage '${stage}' requested for eventType ${eventType} and modelId: ${modelId}`);
            }
        });
    }

    /**
     * Provides a fat pipe of all events sent to models.
     *
     * Note: If an event is published to a model, and that model is not explicitly observing the event, it will get dropped, this won't yield those.
     * @param stage
     */
    public getAllEventsObservable<TModel>(stage?: ObservationStage): Observable<EventEnvelope<any, TModel>>;
    /**
     * Provides a fat pipe of the given events sent to models.
     *
     * Note: If an event is published to a model, and that model is not explicitly observing the event, it will get dropped, this won't yield those.
     * @param stage
     */
    public getAllEventsObservable<TModel>(eventTypes: string[], stage?: ObservationStage): Observable<EventEnvelope<any, TModel>>;
    public getAllEventsObservable<TModel>(...args: any[]): Observable<EventEnvelope<any, TModel>> {
        let eventFilter: (eventType?: string) => boolean;
        let stage: ObservationStage;
        const buildFilter = (eventTypes: string[]) => {
            Guard.lengthIsAtLeast(eventTypes, 1, 'eventTypes.length must be > 0');
            let set = new Set(eventTypes);
            return eventType => set.has(eventType);
        };
        // try figure out which overload was used
        if (!args || args.length === 0) {
            stage = ObservationStage.normal;
            eventFilter = () => true;
        } else if (args.length === 1) {
            // first param could be an array or an observation stage
            if (ObservationStage.isObservationStage(args[0])) {
                stage = this._tryDefaultObservationStage(args[0]);
                eventFilter = () => true;
            } else  {
                // else assume it's an array
                stage = ObservationStage.normal;
                eventFilter = buildFilter(args[0]);
            }
        } else if (args.length === 2) {
            // with this overload, the first param should be an event array
            eventFilter = buildFilter(args[0]);
            stage = this._tryDefaultObservationStage(args[1]);

        } else {
            throw new Error(`unsupported overload called for getAllEventsObservable. Received ${args}.`);
        }
        stage = this._tryDefaultObservationStage(stage);
        return Observable.create(o => {
            this._throwIfHaltedOrDisposed();
            return this._dispatchSubject
                .filter(envelope => envelope.dispatchType === DispatchType.Event)
                .cast<EventEnvelope<any, any>>()
                .filter(envelope => {
                    if (ObservationStage.isAll(stage)) {
                        return true;
                    } else {
                        return envelope.observationStage === stage;
                    }
                })
                .cast<EventEnvelope<any, any>>()
                .filter(envelope => eventFilter(envelope.eventType))
                .subscribe(o);
        });
    }

    public getModelObservable<TModel>(modelId: string): Observable<TModel> {
        return Observable.create(o => {
            this._throwIfHaltedOrDisposed();
            Guard.isString(modelId, 'The modelId should be a string');
            let modelRecord = this._getOrCreateModelRecord(modelId);
            return modelRecord.modelObservationStream
                .map(envelope => envelope.model)
                .subscribe(o);
        });
    }

    public getAllModelsObservable(): Observable<ModelEnvelope<any>> {
        return Observable.create(o => {
            this._throwIfHaltedOrDisposed();
            return this._dispatchSubject
                .filter(envelope => envelope.dispatchType === DispatchType.ModelUpdate || envelope.dispatchType === DispatchType.ModelDelete)
                .cast<ModelEnvelope<any>>()
                .subscribe(o);
        });
    }

    public createObservableFor<TModel>(modelId: string, observer): RouterObservable<TModel> {
        return Observable
            .create<TModel>(observer)
            .asRouterObservable(this)
            .subscribeOn(modelId);
    }

    public createSubject<T>(): RouterSubject<T> {
        return new RouterSubject<T>(this);
    }

    public createModelRouter<TModel>(targetModelId: string) {
        Guard.isString(targetModelId, 'The targetModelId argument should be a string');
        return SingleModelRouter.createWithRouter<TModel>(this, targetModelId);
    }

    public observeEventsOn(modelId: string, object: any): Disposable {
        if (EspDecoratorUtil.hasMetadata(object)) {
            return this._observeEventsUsingDirectives(modelId, object);
        }
        return new DisposableBase();
    }

    public addOnErrorHandler(handler: (error: Error) => void) {
        this._onErrorHandlers.push(handler);
    }

    public removeOnErrorHandler(handler) {
        let index = this._onErrorHandlers.indexOf(handler);
        if (index >= 0) {
            delete this._onErrorHandlers[index];
        } else {
            throw new Error('Unknown error handler.');
        }
    }

    public isOnDispatchLoopFor(modelId: string) {
        Guard.isString(modelId, 'modelId must be a string');
        Guard.isFalsey(modelId === '', 'modelId must not be empty');
        return this._state.currentModelId === modelId;
    }

    private _getOrCreateModelRecord(modelId: string, model?: any, eventProcessors?: EventProcessors): ModelRecord {
        let modelRecord: ModelRecord = this._models.get(modelId);
        if (modelRecord) {
            if (!modelRecord.hasModel) {
                modelRecord.setModel(model, eventProcessors);
            }
        } else {
            let modelObservationStream =  this._dispatchSubject
                .cast<ModelEnvelope<any>>()
                .filter(envelope => envelope.dispatchType === DispatchType.ModelUpdate && envelope.modelId === modelId)
                .share(true);
            modelRecord = new ModelRecord(modelId, model, modelObservationStream, eventProcessors);
            this._models.set(modelId, modelRecord);
        }
        return modelRecord;
    }

    private _tryEnqueueEvent(modelAddress: ModelAddress, eventType: string, event: any) {
        // we allow for lazy model registration, you can observe a model but then register it later,
        // this means at this point when publishing an event we need to ensure the actual model is there.
        if (!this._models.has(modelAddress.modelId) || !this._models.get(modelAddress.modelId).model) {
            throw new Error('Can not publish event of type [' + eventType + '] as model with id [' + modelAddress.modelId + '] not registered');
        } else {
            try {
                if (this._models.has(modelAddress.modelId)) {
                    let modelRecord = this._getOrCreateModelRecord(modelAddress.modelId);
                    if (modelRecord.tryEnqueueEvent(modelAddress.entityKey, eventType, event)) {
                        this._diagnosticMonitor.eventEnqueued(modelAddress.modelId, modelAddress.entityKey, eventType, event);
                        this._purgeEventQueues();
                    }
                }
            } catch (err) {
                this._halt(err);
            }
        }
    }

    private _purgeEventQueues() {
        if (this._state.currentStatus === Status.Idle) {
            let modelRecord = this._getNextModelRecordWithQueuedEvents();
            let hasEvents = !!modelRecord;
            this._diagnosticMonitor.dispatchLoopStart();
            while (hasEvents) {
                let eventRecord: EventRecord = modelRecord.eventQueue.shift();
                this._diagnosticMonitor.startingModelEventLoop(modelRecord.modelId, eventRecord.entityKey, eventRecord.eventType);
                this._state.moveToPreProcessing(modelRecord.modelId, modelRecord);
                this._diagnosticMonitor.preProcessingModel();
                modelRecord.preEventProcessor(modelRecord.model);
                if (!modelRecord.wasRemoved) {
                    this._state.moveToEventDispatch();
                    this._diagnosticMonitor.dispatchingEvents();
                    while (hasEvents) {
                        if (eventRecord.eventType === RUN_ACTION_EVENT_NAME) {
                            this._diagnosticMonitor.dispatchingAction();
                            modelRecord.eventDispatchProcessor(modelRecord.model, null, RUN_ACTION_EVENT_NAME);
                            eventRecord.action(modelRecord.model);
                            modelRecord.eventDispatchedProcessor(modelRecord.model, null, RUN_ACTION_EVENT_NAME);
                        } else {
                            this._state.eventsProcessed.push(eventRecord.eventType);
                            this._dispatchEventToEventProcessors(
                                modelRecord,
                                eventRecord.entityKey,
                                eventRecord.event,
                                eventRecord.eventType
                            );
                        }
                        if (modelRecord.wasRemoved) {
                            break;
                        }
                        modelRecord.hasReceivedEvent = true;
                        hasEvents = modelRecord.eventQueue.length > 0;
                        if (hasEvents) {
                            eventRecord = modelRecord.eventQueue.shift();
                        }
                    } // keep looping until any events from the dispatch to processors stage are processed
                    this._diagnosticMonitor.finishDispatchingEvent();
                    if (!modelRecord.wasRemoved) {
                        this._diagnosticMonitor.postProcessingModel();
                        this._state.moveToPostProcessing();
                        modelRecord.postEventProcessor(modelRecord.model, this._state.eventsProcessed);
                        this._state.clearEventDispatchQueue();
                    }
                }
                modelRecord.eventQueuePurged();
                // we now dispatch updates before processing the next model, if any
                this._state.moveToDispatchModelUpdates();
                this._dispatchModelUpdates();
                modelRecord = this._getNextModelRecordWithQueuedEvents();
                hasEvents = !!modelRecord;
                this._diagnosticMonitor.endingModelEventLoop();
            }  // keep looping until any events raised during post event processing OR event that have come in for other models are processed
            this._state.moveToIdle();
            this._diagnosticMonitor.dispatchLoopEnd();
        }
    }

    private _dispatchEventToEventProcessors(modelRecord: ModelRecord, entityKey: string, event: any, eventType: string): void {
        let eventContext = new DefaultEventContext(
            modelRecord.modelId,
            eventType,
            entityKey
        );
        this._dispatchEvent(modelRecord, entityKey, event, eventType, eventContext, ObservationStage.preview);
        if (eventContext.isCommitted) {
            throw new Error('You can\'t commit an event at the preview stage. Event: [' + eventContext.eventType + '], ModelId: [' + modelRecord.modelId + ']');
        }
        if (!eventContext.isCanceled) {
            let wasCommittedAtNormalStage;
            eventContext.updateCurrentState(ObservationStage.normal);
            this._dispatchEvent(modelRecord, entityKey, event, eventType, eventContext, ObservationStage.normal);
            if (eventContext.isCanceled) {
                throw new Error('You can\'t cancel an event at the normal stage. Event: [' + eventContext.eventType + '], ModelId: [' + modelRecord.modelId + ']');
            }
            wasCommittedAtNormalStage = eventContext.isCommitted;
            if (wasCommittedAtNormalStage) {
                eventContext.updateCurrentState(ObservationStage.committed);
                this._dispatchEvent(modelRecord, entityKey, event, eventType, eventContext, ObservationStage.committed);
                if (eventContext.isCanceled) {
                    throw new Error('You can\'t cancel an event at the committed stage. Event: [' + eventContext.eventType + '], ModelId: [' + modelRecord.modelId + ']');
                }
            }
            eventContext.updateCurrentState(ObservationStage.final);
            this._dispatchEvent(modelRecord, entityKey, event, eventType, eventContext, ObservationStage.final);
            if (eventContext.isCanceled) {
                throw new Error('You can\'t cancel an event at the final stage. Event: [' + eventContext.eventType + '], ModelId: [' + modelRecord.modelId + ']');
            }
            if (!wasCommittedAtNormalStage && eventContext.isCommitted) {
                throw new Error('You can\'t commit an event at the final stage. Event: [' + eventContext.eventType + '], ModelId: [' + modelRecord.modelId + ']');
            }
        }
    }

    private _dispatchEvent(modelRecord: ModelRecord, entityKey: string, event: any, eventType: string, context: EventContext, stage: ObservationStage) {
        this._diagnosticMonitor.dispatchingEvent(eventType, stage);
        modelRecord.eventDispatchProcessor(modelRecord.model, eventType, event, stage);
        this._dispatchSubject.onNext({
            event: event,
            eventType: eventType,
            modelId: modelRecord.modelId,
            entityKey: entityKey,
            model: modelRecord.model,
            context: context,
            observationStage: stage,
            dispatchType: DispatchType.Event
        });
        modelRecord.eventDispatchedProcessor(modelRecord.model, eventType, event, stage);
    }

    private _dispatchModelUpdates() {
        let updates: ModelRecord[] = [];
        for (let [key, value] of this._models) {
            if (value.hasReceivedEvent) {
                value.hasReceivedEvent = false;
                updates.push(value);
            }
        }
        for (let i = 0, len = updates.length; i < len; i++) {
            let modelRecord: ModelRecord = updates[i];
            this._diagnosticMonitor.dispatchingModelUpdates(modelRecord.modelId, modelRecord.model);
            this._dispatchSubject.onNext({
                modelId: modelRecord.modelId,
                model: modelRecord.model,
                dispatchType: DispatchType.ModelUpdate
            });
        }
    }

    /**
     * Tries to find the a ModelRecord with pending events.
     * ModelRecord's with older enqueued events are returned first.
     * @private
     */
    private _getNextModelRecordWithQueuedEvents(): ModelRecord {
        let candidate: ModelRecord = null;
        let dirtyEpochMs: number = Date.now();
        for (let [key, value] of this._models) {
            if (value.eventQueue.length > 0 && value.eventQueueDirtyEpochMs <= dirtyEpochMs) {
                candidate = value;
                dirtyEpochMs = value.eventQueueDirtyEpochMs;
            }
        }
        return candidate;
    }

    private _observeEventsUsingDirectives(modelId: string, object: any) {
        if (this._decoratorObservationRegister.isRegistered(modelId, object)) {
            // tslint:disable-next-line:max-line-length
            throw new Error(`observeEventsOn has already been called for model with id '${modelId}' and the given object. Note you can observe the same model with different decorated objects, however you have called observeEventsOn twice with the same object.`);
        }
        this._decoratorObservationRegister.register(modelId, object);
        let compositeDisposable = new CompositeDisposable();
        let eventsDetails = EspDecoratorUtil.getAllEvents(object);
        for (let i = 0; i < eventsDetails.length; i++) {
            let details = eventsDetails[i];
            compositeDisposable.add(this.getEventObservable(modelId, details.eventType, details.observationStage).subscribe((eventEnvelope) => {
                // note if the code is uglifyied then details.functionName isn't going to mean much.
                // If you're packing your vendor bundles, or debug bundles separately then you can use the no-mangle-functions option to retain function names.
                let predicate = <ObserveEventPredicate>details.predicate;
                if (!predicate || predicate(object, eventEnvelope.event, eventEnvelope.context)) {
                    this._diagnosticMonitor.dispatchingViaDirective(details.functionName);
                    if (details.decoratorType === DecoratorTypes.observeEvent) {
                        object[details.functionName](eventEnvelope.event, eventEnvelope.context, eventEnvelope.model);
                    } else {
                        object[details.functionName](eventEnvelope);
                    }
                }
            }));
        }
        compositeDisposable.add(() => {
            this._decoratorObservationRegister.removeRegistration(modelId, object);
        });
        return compositeDisposable;
    }

    private _tryDefaultObservationStage(stage?: ObservationStage) {
        if (stage) {
            Guard.isString(stage, 'The stage argument should be a string');
            Guard.isTruthy(ObservationStage.isObservationStage(stage), 'The stage argument value of [' + stage + '] is incorrect. It should be ObservationStage.preview, ObservationStage.normal, ObservationStage.committed or ObservationStage.all.');
            return stage;
        } else {
            return ObservationStage.normal;
        }
    }

    private _throwIfHaltedOrDisposed() {
        if (this._state.currentStatus === Status.Halted) {
            throw new Error(`ESP router halted due to previous unhandled error [${this._haltingException}]`);
        }
        if (this.isDisposed) {
            throw new Error(`ESP router has been disposed`);
        }
    }

    private _halt(err: any) {
        let isInitialHaltingError = this._state.currentStatus !== Status.Halted;

        this._state.moveToHalted();

        let modelIds = [...this._models.keys()];
        this._diagnosticMonitor.halted(modelIds, err);
        let errorMessage = 'The ESP router has caught an unhandled error and will halt';
        _log.error(errorMessage, err);
        this._haltingException = err;

        // We run the onErrorHandlers after the
        // router has had time to set it's own state
        if (isInitialHaltingError) {
            this._currentHealth = Health.builder(this.healthIndicatorName)
                .isTerminal()
                .addReason(`${errorMessage} - ${err}`)
                .build();
            this._onErrorHandlers.forEach(handler => {
                try {
                    handler(err);
                } catch (handlerError) {
                    _log.info(`Error handler errored. Ignoring and continuing, Error = ${handlerError}`, handlerError);
                }
            });
        }

        throw err;
    }
}
