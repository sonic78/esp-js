import {ObservationStage, Router, logging} from 'esp-js';
import {defaultStoreFactory, OOModelTestState, ReceivedEvent, TestEvent, TestState, TestStore} from './testStore';
import {TestStateHandlerMap, TestStateHandlerModel, TestStateObjectHandler} from './stateHandlers';
import {PolimerModel, PolimerStoreBuilder} from '../../src';
import {StorePostEventProcessor, StorePreEventProcessor} from '../../src/eventProcessors';
import {ObjectEventTransforms} from './eventTransforms';

export interface PolimerTestApi {
    removeModel();
    disposeModel();
    actor: Actor;
    store: TestStore;
    asserts: Asserts;
    router: Router;
}

export class ReceivedEventsAsserts {
    constructor(private _parent: StateAsserts, private _receivedEvents: ReceivedEvent[]) {

    }
    public eventCountIs(expectedLength: number): this {
        expect(this._receivedEvents.length).toEqual(expectedLength);
        return this;
    }

    public callIs(callNumber: number, eventType: string, event: TestEvent, stage: ObservationStage): this {
        this.eventTypeIs(callNumber, eventType);
        this.eventIs(callNumber, event);
        this.observationStageIs(callNumber, stage);
        return this;
    }

    public eventTypeIs(callNumber: number, eventType: string): this {
        expect(this._receivedEvents[callNumber].eventType).toEqual(eventType);
        return this;
    }

    public eventIs(callNumber: number, event: TestEvent): this {
        expect(this._receivedEvents[callNumber].receivedEvent).toBe(event);
        return this;
    }

    public eventKeyIs(callNumber: number, key: string): this {
        expect(this._receivedEvents[callNumber].receivedEvent.eventKey).toBe(key);
        return this;
    }

    public eventTransformedKeyIs(callNumber: number, key: string): this {
        expect(this._receivedEvents[callNumber].receivedEvent.transformedEventKey).toBe(key);
        return this;
    }

    public observationStageIs(callNumber: number, stage: ObservationStage): this {
        expect(this._receivedEvents[callNumber].observationStage).toEqual(stage);
        return this;
    }

    public stateIs(callNumber: number, expectedStateName: string): this {
        let receivedArgument = this._receivedEvents[callNumber];
        expect(receivedArgument.stateReceived).toEqual(true);
        expect(receivedArgument.stateName).toEqual(expectedStateName);
        return this;
    }

    public ensureEventContextReceived(callNumber: number): this {
        expect(this._receivedEvents[callNumber].eventContextReceived).toEqual(true);
        return this;
    }

    public ensureStoreReceived(callNumber: number): this {
        expect(this._receivedEvents[callNumber].storeReceived).toEqual(true);
        return this;
    }

    public end(): StateAsserts {
        return this._parent;
    }
}

export class StateAsserts {
    private _lastState: TestState;
    constructor(protected _stateGetter: () => TestState) {

    }
    protected get _state() {
        return this._stateGetter();
    }
    public captureCurrentState(): this {
        this._lastState = this._stateGetter();
        return this;
    }
    public stateInstanceHasChanged(expectedNextState?: TestState): this {
        // preconditions
        expect(this._lastState).toBeDefined();
        const currentState = this._stateGetter();
        expect(this._lastState).toBeDefined();
        expect(this._lastState).not.toBe(currentState);
        if (expectedNextState) {
            expect(currentState).toBe(expectedNextState);
        }
        return this;
    }
    public previewEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtPreview);
    }
    public normalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtNormal);
    }
    public committedEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtCommitted);
    }
    public finalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtFinal);
    }
    public receivedEventsAll(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAll);
    }
}

export class OOModelTestStateAsserts extends StateAsserts {
    constructor(private _ooModelTestStateGetter: () => OOModelTestState, private _testStateHandlerModel: TestStateHandlerModel) {
        super(_ooModelTestStateGetter);
    }
    public preProcessInvokeCountIs(expected: number): this {
        expect(this._ooModelTestStateGetter().preProcessInvokeCount).toEqual(expected);
        return this;
    }
    public postProcessInvokeCountIs(expected: number): this {
        expect(this._ooModelTestStateGetter().postProcessInvokeCount).toEqual(expected);
        return this;
    }
    public isDisposed(isDisposed: boolean = false): this {
        expect(this._testStateHandlerModel.isDisposed).toEqual(isDisposed);
        return this;
    }
}

export class Actor {
    constructor(private _modelId: string, private _router: Router) {
    }
    public publishEvent(eventType: string, event?: TestEvent) {
        event = event || {};
        this._router.publishEvent(this._modelId, eventType, event);
        return event;
    }
    public publishEventWhichFiltersAtPreviewStage<TKey extends keyof TestStore>(eventType: string) {
        let testEvent = <TestEvent>{ shouldFilter: true, filterAtStage: ObservationStage.preview};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichFiltersAtNormalStage<TKey extends keyof TestStore>(eventType: string) {
        let testEvent = <TestEvent>{ shouldFilter: true, filterAtStage: ObservationStage.normal};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichFiltersAtCommitStage<TKey extends keyof TestStore>(eventType: string) {
        let testEvent = <TestEvent>{ shouldFilter: true, filterAtStage: ObservationStage.committed};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCancelsAtPreviewStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCancel: true, cancelAtStage: ObservationStage.preview, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCancelsAtNormalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCancel: true, cancelAtStage: ObservationStage.normal, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCancelsAtFinalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCancel: true, cancelAtStage: ObservationStage.final, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCancelsAtCommittedStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{
            shouldCommit: true,
            commitAtStages: [ObservationStage.normal],
            shouldCancel: true,
            cancelAtStage: ObservationStage.committed,
            stateTakingAction: stateNameWhichDoesTheCommit
        };
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCancelsInEventFilter<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCancel: true, cancelInEventFilter: true, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCommitsAtPreviewStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCommit: true, commitAtStages: [ObservationStage.preview], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCommitsAtNormalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCommit: true, commitAtStages: [ObservationStage.normal], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCommitsAtCommittedStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{
            shouldCommit: true,
            commitAtStages: [ObservationStage.normal, ObservationStage.committed],
            stateTakingAction: stateNameWhichDoesTheCommit
        };
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCommitsAtFinalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCommit: true, commitAtStages: [ObservationStage.final], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
    public publishEventWhichCommitsInEventFilter<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{ shouldCommit: true, commitInEventFilter: true, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
}

export class Asserts {
    private _handlerMapState: StateAsserts;
    private _handlerObjectState: StateAsserts;
    private _handlerModelState: OOModelTestStateAsserts;

    constructor(private _router: Router, private _model: PolimerModel<TestStore>, private _testEventProcessors: TestEventProcessors, testStateHandlerModel: TestStateHandlerModel) {
        this._handlerMapState = new StateAsserts(() => this._model.getStore().handlerMapState);
        this._handlerObjectState = new StateAsserts(() => this._model.getStore().handlerObjectState);
        this._handlerModelState = new OOModelTestStateAsserts(() => this._model.getStore().handlerModelState, testStateHandlerModel);
    }
    public get handlerMapState() { return this._handlerMapState; }
    public get handlerObjectState() { return this._handlerObjectState; }
    public get handlerModelState() { return this._handlerModelState; }
    public throwsOnInvalidEventContextAction(action: () => void, errorRegex?: RegExp): this {
        expect(action).toThrow(errorRegex || /You can't .* an event at the .* stage.*/);
        return this;
    }
    public preEventProcessorCountIs(expectedInvokeCount: number): this {
        expect(this._testEventProcessors.preEventProcessorInvokeCount).toEqual(expectedInvokeCount);
        return this;
    }
    public postEventProcessorCountIs(expectedInvokeCount: number): this {
        expect(this._testEventProcessors.postEventProcessorInvokeCount).toEqual(expectedInvokeCount);
        return this;
    }
    public polimerModelIsRegistered(isRegistered: boolean = true): this {
        expect(this._router.isModelRegistered(this._model.modelId)).toEqual(isRegistered);
        return this;
    }
}

class TestEventProcessors {
    private _preEventProcessorInvokeCount: number = 0;
    private _preEventProcessor?: StorePreEventProcessor<TestStore>;

    private _postEventProcessorInvokeCount: number = 0;
    private _postEventProcessor?: StorePostEventProcessor<TestStore>;

    constructor() {
        this._preEventProcessor = () => {
            this._preEventProcessorInvokeCount++;
        };
        this._postEventProcessor = () => {
            this._postEventProcessorInvokeCount++;
        };
    }
    public get preEventProcessorInvokeCount() {
        return this._preEventProcessorInvokeCount;
    }
    public get preEventProcessor() {
        return this._preEventProcessor;
    }
    public get postEventProcessorInvokeCount() {
        return this._postEventProcessorInvokeCount;
    }
    public get postEventProcessor() {
        return this._postEventProcessor;
    }
}

export class PolimerTestApiBuilder {
    private _useHandlerMap: boolean = false;
    private _useHandlerObject: boolean = false;
    private _useHandlerModel: boolean = false;
    private _handlerModelAutoWireUp: boolean = false;
    private _useEventTransformModel: boolean = false;

    public static create(): PolimerTestApiBuilder {
        return new PolimerTestApiBuilder();
    }

    public withStateHandlerMap() {
        this._useHandlerMap = true;
        return this;
    }

    public withStateHandlerObject() {
        this._useHandlerObject = true;
        return this;
    }

    public withStateHandlerModel(autoWireUp = false) {
        this._useHandlerModel = true;
        this._handlerModelAutoWireUp = autoWireUp;
        return this;
    }

    public withEventTransformModel() {
        this._useEventTransformModel = true;
        return this;
    }

    public build(): PolimerTestApi {
        // stop esp logging to the console by default (so unhappy path tests to fill up the console with errors).
        logging.Logger.setSink(() => {});
        let testEventProcessors = new TestEventProcessors();
        let testStateHandlerModel: TestStateHandlerModel;
        let router = new Router();
        let modelId = 'modelId';
        let initialStore = defaultStoreFactory(modelId);
        let builder: PolimerStoreBuilder<TestStore>  = router
            .storeBuilder<TestStore>()
            .withInitialStore(initialStore);
        if (this._useHandlerMap) {
            builder.withStateHandlerMap('handlerMapState', TestStateHandlerMap);
        }
        if (this._useHandlerObject) {
            builder.withStateHandlerObject('handlerObjectState', new TestStateObjectHandler(router));
        }
        if (this._useHandlerModel) {
            testStateHandlerModel = new TestStateHandlerModel(modelId, router);
            builder.withStateHandlerModel('handlerModelState', testStateHandlerModel, this._handlerModelAutoWireUp);
            if (!this._handlerModelAutoWireUp) {
                testStateHandlerModel.initialise();
            }
        }
        if (this._useEventTransformModel) {
            builder.withEventStreamsOn(new ObjectEventTransforms());
        }
        builder
            .withPreEventProcessor(testEventProcessors.preEventProcessor)
            .withPostEventProcessor(testEventProcessors.postEventProcessor);
        let model = builder.registerWithRouter();
        // TestStateObject is a classic esp model, it is modeled here to have a typical external lifecycle and manages it's state internally
        let currentStore: TestStore;
        router.getModelObservable<PolimerModel<TestStore>>(modelId).map(m => m.getStore()).subscribe(store => {
            currentStore = store;
        });
        return {
            removeModel() {
                router.removeModel(modelId);
            },
            disposeModel() {
                model.dispose();
            },
            actor: new Actor(modelId, router),
            get store() {
                return this.model.getStore();
            },
            asserts: new Asserts(router, model, testEventProcessors, testStateHandlerModel),
            router
        };
    }
}