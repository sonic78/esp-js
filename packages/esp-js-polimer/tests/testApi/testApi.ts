import {ObservationStage, Router, utils} from 'esp-js';
import {defaultModelFactory, OOModelTestState, ReceivedEvent, TestEvent, TestImmutableModel, TestState} from './testModel';
import {TestStateHandlerModel, TestStateObjectHandler} from './stateHandlers';
import {PolimerModel, PolimerModelBuilder} from '../../src';
import {ModelPostEventProcessor, ModelPreEventProcessor} from '../../src/eventProcessors';
import {ObjectEventTransforms} from './eventTransforms';
import {EventEnvelopePredicate} from '../../src/eventEnvelopePredicate';

export interface PolimerTestApi {
    removeModel();

    disposeModel();

    actor: Actor;
    model: TestImmutableModel;
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

    public eventEntityKey(callNumber: number, entityKey: string): this {
        expect(this._receivedEvents[callNumber].entityKey).toEqual(entityKey);
        return this;
    }

    public eventIs(callNumber: number, event: TestEvent): this;
    public eventIs(callNumber: number, predicate: (event: TestEvent) => boolean): this;
    public eventIs(...args: any[]): this {
        const callNumber = args[0];
        let receivedEvent = this._receivedEvents[callNumber].receivedEvent;
        if (utils.isFunction(args[1])) {
            let testPassed = args[1](receivedEvent);
            if (!testPassed) {
                fail(`Predicated for specified event at callNumber ${callNumber} failed. Event received was ${JSON.stringify(receivedEvent)}`);
            }
        } else {
            expect(receivedEvent).toBe(args[1]);
        }
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

    public handlerProcessingEventIs(callNumber: number, expectedHandlerName: string): this {
        let receivedArgument = this._receivedEvents[callNumber];
        expect(receivedArgument.nameOfStateHandlerReceivingEvent).toEqual(expectedHandlerName);
        return this;
    }

    public ensureEventContextReceived(callNumber: number): this {
        expect(this._receivedEvents[callNumber].eventContextReceived).toEqual(true);
        return this;
    }

    public ensureModelReceived(callNumber: number): this {
        expect(this._receivedEvents[callNumber].modelReceived).toEqual(true);
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

    public captureCurrentState(): this {
        this._lastState = this._stateGetter();
        return this;
    }

    public stateNameIs(name: string): this {
        const currentState = this._stateGetter();
        expect(currentState.stateName).toEqual(name);
        return this;
    }

    public stateInstanceHasChanged(expectedNextState?: TestState): this {
        // preconditions
        expect(this._lastState).toBeDefined();
        const currentState = this._stateGetter();
        expect(this._lastState).not.toBe(currentState);
        if (expectedNextState) {
            expect(currentState).toBe(expectedNextState);
        }
        return this;
    }

    public previewEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._stateGetter().receivedEventsAtPreview);
    }

    public normalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._stateGetter().receivedEventsAtNormal);
    }

    public committedEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._stateGetter().receivedEventsAtCommitted);
    }

    public finalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._stateGetter().receivedEventsAtFinal);
    }

    public receivedEventsAll(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._stateGetter().receivedEventsAll);
    }
}

export class ImmutableModelAsserts {
    private _lastTestImmutableModel: TestImmutableModel;

    constructor(private _model: PolimerModel<TestImmutableModel>) {

    }

    public captureCurrentImmutableModel(): this {
        this._lastTestImmutableModel = this._model.getEspPolimerImmutableModel();
        return this;
    }

    public immutableModelHasChanged(): this {
        expect(this._lastTestImmutableModel).toBeDefined();
        expect(this._lastTestImmutableModel).not.toBe(this._model.getEspPolimerImmutableModel());
        return this;
    }
}

export class MapStateAsserts {
    private _lastState: Map<string, TestState>;

    constructor(private _mapGetter: () => Map<string, TestState>) {
    }

    public captureCurrentState(): this {
        this._lastState = this._mapGetter();
        return this;
    }

    public stateInstanceHasChanged(): this {
        expect(this._lastState).toBeDefined();
        const currentState = this._mapGetter();
        expect(this._lastState).not.toBe(currentState);
        return this;
    }

    public sizeIs(size: number): this {
        const currentState = this._mapGetter();
        expect(currentState.size).toEqual(size);
        return this;
    }

    public entity(entityKey: string): StateAsserts {
        return new StateAsserts(() => this._mapGetter().get(entityKey));
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

    public eventHandlersReceivedStateOnModelMatchesLocalState(): this {
        expect(this._ooModelTestStateGetter().eventHandlersReceivedStateOnModelMatchesLocalState).toEqual(true);
        return this;
    }

    public modelsStateMatchesModelsState(): this {
        expect(this._testStateHandlerModel.currentState).toBe(this._ooModelTestStateGetter());
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

    public broadcastEvent(eventType: string, event?: TestEvent) {
        event = event || {};
        this._router.broadcastEvent(eventType, event);
        return event;
    }

    public publishEventWhichFiltersAtPreviewStage<TKey extends keyof TestImmutableModel>(eventType: string) {
        let testEvent = <TestEvent>{shouldFilter: true, filterAtStage: ObservationStage.preview};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichFiltersAtNormalStage<TKey extends keyof TestImmutableModel>(eventType: string) {
        let testEvent = <TestEvent>{shouldFilter: true, filterAtStage: ObservationStage.normal};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichFiltersAtCommitStage<TKey extends keyof TestImmutableModel>(eventType: string) {
        let testEvent = <TestEvent>{shouldFilter: true, filterAtStage: ObservationStage.committed};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCancelsAtPreviewStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCancel: true, cancelAtStage: ObservationStage.preview, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCancelsAtNormalStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCancel: true, cancelAtStage: ObservationStage.normal, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCancelsAtFinalStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCancel: true, cancelAtStage: ObservationStage.final, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCancelsAtCommittedStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
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

    public publishEventWhichCancelsInEventFilter<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCancel: true, cancelInEventFilter: true, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCommitsAtPreviewStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCommit: true, commitAtStages: [ObservationStage.preview], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCommitsAtNormalStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCommit: true, commitAtStages: [ObservationStage.normal], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCommitsAtCommittedStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{
            shouldCommit: true,
            commitAtStages: [ObservationStage.normal, ObservationStage.committed],
            stateTakingAction: stateNameWhichDoesTheCommit
        };
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCommitsAtFinalStage<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCommit: true, commitAtStages: [ObservationStage.final], stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }

    public publishEventWhichCommitsInEventFilter<TKey extends keyof TestImmutableModel>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
        let testEvent = <TestEvent>{shouldCommit: true, commitInEventFilter: true, stateTakingAction: stateNameWhichDoesTheCommit};
        this._router.publishEvent(this._modelId, eventType, testEvent);
        return testEvent;
    }
}

export class Asserts {
    private _handlerObjectState: StateAsserts;
    private _handlerObjectState2: StateAsserts;
    private _handlerObjectState3: StateAsserts;
    private _handlerModelState: OOModelTestStateAsserts;
    private _immutableModelAsserts: ImmutableModelAsserts;

    constructor(private _router: Router, private _model: PolimerModel<TestImmutableModel>, private _testEventProcessors: TestEventProcessors, testStateHandlerModel: TestStateHandlerModel) {
        this._handlerObjectState = new StateAsserts(() => this._model.getImmutableModel().handlerObjectState);
        this._handlerObjectState2 = new StateAsserts(() => this._model.getImmutableModel().handlerObjectState2);
        this._handlerObjectState3 = new StateAsserts(() => this._model.getImmutableModel().handlerObjectState3);
        this._handlerModelState = new OOModelTestStateAsserts(() => this._model.getImmutableModel().handlerModelState, testStateHandlerModel);
        this._immutableModelAsserts = new ImmutableModelAsserts(this._model);
    }

    public get handlerObjectState() {
        return this._handlerObjectState;
    }

    public get handlerObjectState2() {
        return this._handlerObjectState2;
    }

    public get handlerObjectState3() {
        return this._handlerObjectState3;
    }

    public get handlerModelState() {
        return this._handlerModelState;
    }

    public get immutableModelAsserts() {
        return this._immutableModelAsserts;
    }

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

    public assertSavedState(assertingFunction: (savedStateState) => void) {
        assertingFunction(this._model.getEspUiModelState());
        return this;
    }
}

class TestEventProcessors {
    private _preEventProcessorInvokeCount: number = 0;
    private _preEventProcessor?: ModelPreEventProcessor<TestImmutableModel>;

    private _postEventProcessorInvokeCount: number = 0;
    private _postEventProcessor?: ModelPostEventProcessor<TestImmutableModel>;

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

export interface StateHandlerConfig {
    state: string;
    deliveryPredicate?: EventEnvelopePredicate<unknown, unknown>;
    stateHandlers?: object[];
}

export interface EventTransformConfig {
    deliveryPredicate?: EventEnvelopePredicate<unknown, unknown>;
    transforms?: object[];
}

export class PolimerTestApiBuilder {
    private _stateHandlerModel: any = null;
    private _handlerModelAutoWireUp: boolean = false;
    private _stateHandlerConfigurations: StateHandlerConfig[] = [];
    private _eventTransformConfigurations: EventTransformConfig[] = [];
    private _stateSaveHandler: (model: TestImmutableModel) => any;
    private _modelId = 'modelId';
    public router = new Router();

    public static create(): PolimerTestApiBuilder {
        return new PolimerTestApiBuilder();
    }

    public withStateHandlerModel(autoWireUp = false, modelEntity: any = null) {
        if (modelEntity) {
            this._stateHandlerModel = modelEntity;
        } else {
            this._stateHandlerModel = new TestStateHandlerModel(this._modelId, this.router);
        }
        this._handlerModelAutoWireUp = autoWireUp;
        return this;
    }

    public withStateHandlers(...configurations: StateHandlerConfig[]) {
        if (configurations.length === 0) {
            this._stateHandlerConfigurations.push({ state: 'handlerObjectState', stateHandlers: [new TestStateObjectHandler({router: this.router})] });
        } else {
            this._stateHandlerConfigurations.push(...configurations);
        }
        return this;
    }

    public withEventTransforms(...configurations: EventTransformConfig[]) {
        if (configurations.length === 0) {
            this._eventTransformConfigurations.push({ transforms: [new ObjectEventTransforms()] });
        } else {
            this._eventTransformConfigurations.push(...configurations);
        }
        return this;
    }

    public withStateSaveHandler(handler: (model: TestImmutableModel) => any) {
        this._stateSaveHandler = handler;
        return this;
    }

    public build(): PolimerTestApi {
        // stop esp logging to the console by default (so unhappy path tests to fill up the console with errors).
        let testEventProcessors = new TestEventProcessors();
        let initialModel = defaultModelFactory(this._modelId);
        let builder: PolimerModelBuilder<TestImmutableModel> = this.router
            .modelBuilder<TestImmutableModel>()
            .withInitialModel(initialModel)
            .withStateSaveHandler(this._stateSaveHandler);
        if (this._stateHandlerModel) {
            builder.withStateHandlerModel('handlerModelState', this._stateHandlerModel, this._handlerModelAutoWireUp);
            if (!this._handlerModelAutoWireUp) {
                this._stateHandlerModel.initialise();
            }
        }
        if (this._stateHandlerConfigurations.length > 0) {
            this._stateHandlerConfigurations.forEach(configuration => {
                const state = configuration.state || 'handlerObjectState';
                const handlers = configuration.stateHandlers?.length > 0
                    ? [...configuration.stateHandlers]
                    : [new TestStateObjectHandler({router: this.router})];
                if (configuration.state && configuration.deliveryPredicate) {
                    builder.withStateHandlers(state, configuration.deliveryPredicate, ...handlers);
                } else if (configuration.state) {
                    builder.withStateHandlers(state, ...handlers);
                }
            });
        }
        if (this._eventTransformConfigurations.length > 0) {
            this._eventTransformConfigurations.forEach(configuration => {
                const transforms = configuration.transforms?.length > 0
                    ? [...configuration.transforms]
                    : [new ObjectEventTransforms()];
                if (configuration.deliveryPredicate) {
                    builder.withEventTransforms(configuration.deliveryPredicate, ...transforms);
                } else {
                    builder.withEventTransforms(...transforms);
                }
            });
        }
        builder
            .withPreEventProcessor(testEventProcessors.preEventProcessor)
            .withPostEventProcessor(testEventProcessors.postEventProcessor);
        let model = builder.registerWithRouter();
        // TestStateObject is a classic esp model, it is modeled here to have a typical external lifecycle and manages it's state internally
        let currentModel: TestImmutableModel;
        this.router.getModelObservable<PolimerModel<TestImmutableModel>>(this._modelId).map(m => m.getImmutableModel()).subscribe(m1 => {
            currentModel = m1;
        });
        return PolimerTestApiBuilder.createTestApi(this.router, model, testEventProcessors, this._stateHandlerModel);
    }

    private static createTestApi(router: Router, model: PolimerModel<TestImmutableModel>, testEventProcessors: TestEventProcessors, stateHandlerModel: any) {
        return {
            removeModel() {
                router.removeModel(model.modelId);
            },
            disposeModel() {
                model.dispose();
            },
            actor: new Actor(model.modelId, router),
            get model() {
                return model.getImmutableModel();
            },
            asserts: new Asserts(router, model, testEventProcessors, stateHandlerModel),
            router: router
        };
    }
}