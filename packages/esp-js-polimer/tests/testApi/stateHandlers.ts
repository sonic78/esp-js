import {PolimerModel} from '../../src/';
import {defaultOOModelTestStateFactory, EventConst, OOModelTestState, ReceivedEvent, TestEvent, TestState, TestImmutableModel} from './testModel';
import {EventContext, DefaultEventContext, ObservationStage, observeEvent, PolimerEventPredicate, ObserveEventPredicate, DisposableBase, Router} from 'esp-js';

function updateDraftWithEventDetails(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext, stateHandlerName: string, handlersEntityKey?: string) {
    let receivedEvent = <ReceivedEvent>{
        eventType: eventContext.eventType,
        receivedEvent: ev,
        observationStage: eventContext.currentStage,
        stateName: draft.stateName,
        stateReceived: isTestState(draft),
        modelReceived: isImmutableTestModel(model),
        eventContextReceived: eventContext instanceof DefaultEventContext,
        entityKey: eventContext.entityKey,
        nameOfStateHandlerReceivingEvent: stateHandlerName
    };
    if (eventContext.currentStage === ObservationStage.preview) {
        draft.receivedEventsAtPreview.push(receivedEvent);
    } else if (eventContext.currentStage === ObservationStage.normal) {
        draft.receivedEventsAtNormal.push(receivedEvent);
    } else if (eventContext.currentStage === ObservationStage.committed) {
        draft.receivedEventsAtCommitted.push(receivedEvent);
    } else if (eventContext.currentStage === ObservationStage.final) {
        draft.receivedEventsAtFinal.push(receivedEvent);
    }
    draft.receivedEventsAll.push(receivedEvent);
    if (ev.stateTakingAction === draft.stateName) {
        if (ev.shouldCancel && eventContext.currentStage === ev.cancelAtStage) {
            eventContext.cancel();
        }
        if (ev.shouldCommit && ev.commitAtStages && ev.commitAtStages.includes(eventContext.currentStage)) {
            eventContext.commit();
        }
    }
    if (draft.entityKeyOfHandler && handlersEntityKey !== handlersEntityKey) {
        throw new Error(`entity key of handler should not change. Was: ${draft.entityKeyOfHandler}, changed: ${handlersEntityKey}`);
    }
    draft.entityKeyOfHandler = handlersEntityKey;
}

function isTestState(state: any): state is TestState {
    let testState = <TestState>state;
    return testState && testState.stateName !== undefined;
}

function isImmutableTestModel(model: any): model is TestImmutableModel {
    let testModel = <TestImmutableModel>model;
    return testModel && (
        testModel.handlerModelState !== undefined &&
        testModel.handlerObjectState !== undefined
    );
}

const polimerEventPredicate: PolimerEventPredicate = (draft: TestState, event: TestEvent, model: TestImmutableModel, eventContext: EventContext) => {
    if (event.shouldCancel && event.cancelInEventFilter) {
        eventContext.cancel();
    }
    if (event.shouldCommit && event.commitInEventFilter) {
        eventContext.commit();
    }
    return !event.shouldFilter;
};

const observeEventPredicate: ObserveEventPredicate = (model?: any, event?: TestEvent, eventContext?: EventContext) => {
    if (event.shouldCancel && event.cancelInEventFilter) {
        eventContext.cancel();
    }
    if (event.shouldCommit && event.commitInEventFilter) {
        eventContext.commit();
    }
    return !event.shouldFilter;
};

export interface TestStateObjectHandlerOptions {
    router: Router;
    entityKeyOfHandler?: string;
    stateHandlerName?: string;
}

export class TestStateObjectHandler {
    private _router: Router;
    private _stateHandlerName: string;
    private _entityKeyOfHandler?: string;

    constructor(options: TestStateObjectHandlerOptions) {
        this._router = options.router;
        this._entityKeyOfHandler = options.entityKeyOfHandler;
        this._stateHandlerName = options.stateHandlerName || 'defaultHandlerName';
    }

    @observeEvent(EventConst.event1, ObservationStage.preview)
    @observeEvent(EventConst.event1) // defaults to ObservationStage.normal
    @observeEvent(EventConst.event1, ObservationStage.committed)
    @observeEvent(EventConst.event1, ObservationStage.final)
    _event1Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }

    @observeEvent(EventConst.event2, ObservationStage.preview)
    @observeEvent(EventConst.event2, ObservationStage.normal)
    @observeEvent(EventConst.event2, ObservationStage.committed)
    @observeEvent(EventConst.event2, ObservationStage.final)
    _event2Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }
    @observeEvent(EventConst.event3)
    @observeEvent(EventConst.event4)
    _event3And4Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }

    @observeEvent(EventConst.event5, polimerEventPredicate)
    _event5Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        if (ev.replacementState) {
            return ev.replacementState;
        }
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }

    @observeEvent(EventConst.event6)
    _event6Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
        this._router.publishEvent(model.modelId, EventConst.event5, <TestEvent>{ stateTakingAction: 'handlerObjectState' });
    }

    @observeEvent(EventConst.event7)
    _event7Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }

    @observeEvent(EventConst.event8)
    _event8Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }

    @observeEvent(EventConst.event9)
    _event9Handler(draft: TestState, ev: TestEvent, model: TestImmutableModel, eventContext: EventContext) {
        updateDraftWithEventDetails(draft, ev, model, eventContext, this._stateHandlerName, this._entityKeyOfHandler);
    }
}

export class TestStateObjectHandlerForMapState {
    @observeEvent(EventConst.event1) // defaults to ObservationStage.normal
    _event1Handler(draft: Map<string, TestState>, ev: any, model: TestImmutableModel, eventContext: EventContext) {
        draft.set(ev.newKey, ev.testState);
    }
}

// this model is a more classic esp based model which can interop with polimer state handlers,
// it won't receive an immer based model to mutate state, rather state is maintained internally
export class TestStateHandlerModel extends DisposableBase {
    private _currentState: OOModelTestState;
    private _stateHandlerName = 'defaultModelStateHandler';

    constructor(private _modelId, private _router: Router) {
        super();
        this._currentState = defaultOOModelTestStateFactory('handlerModelState');
    }

    public preProcess() {
        let preProcessInvokeCount = this._currentState.preProcessInvokeCount + 1;
        this._currentState = {
            ...this._currentState,
            preProcessInvokeCount
        };
    }

    public postProcess() {
        let postProcessInvokeCount = this._currentState.postProcessInvokeCount + 1;
        this._currentState = {
            ...this._currentState,
            postProcessInvokeCount
        };
    }

    public initialise(): void {
        this.addDisposable(this._router.observeEventsOn(this._modelId, this));
    }

    public get currentState(): OOModelTestState {
        return this._currentState;
    }

    public dispose() {
        super.dispose();
    }

    @observeEvent(EventConst.event1, ObservationStage.preview)
    @observeEvent(EventConst.event1) // defaults to ObservationStage.normal
    @observeEvent(EventConst.event1, ObservationStage.committed)
    @observeEvent(EventConst.event1, ObservationStage.final)
    _event1Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    @observeEvent(EventConst.event2, ObservationStage.preview)
    @observeEvent(EventConst.event2, ObservationStage.normal)
    @observeEvent(EventConst.event2, ObservationStage.committed)
    @observeEvent(EventConst.event2, ObservationStage.final)
    _event2Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    @observeEvent(EventConst.event3)
    @observeEvent(EventConst.event4)
    _event3And4Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    @observeEvent(EventConst.event5, observeEventPredicate)
    _event5Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    @observeEvent(EventConst.event7)
    _event7Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    @observeEvent(EventConst.event8)
    _event8Handler(ev: TestEvent, eventContext: EventContext, model: PolimerModel<TestImmutableModel>) {
        this._ensureModelStateMatchesLocal(model);
        updateDraftWithEventDetails(this._currentState, ev, model.getImmutableModel(), eventContext, this._stateHandlerName);
        this._replaceState();
    }

    private _ensureModelStateMatchesLocal(model: PolimerModel<TestImmutableModel>) {
        let localStateMatchesModelsCopy = this._currentState === model.getImmutableModel().handlerModelState;
        this._currentState = {
            ...this._currentState,
            eventHandlersReceivedStateOnModelMatchesLocalState: localStateMatchesModelsCopy
        };
    }

    private _replaceState() {
        // emulate internal update of immutable state
        this._currentState = { ... this._currentState };
    }

    public getEspPolimerState(): OOModelTestState {
        return this._currentState;
    }
}