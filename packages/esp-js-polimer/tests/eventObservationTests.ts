import {ObservationStage, EventEnvelope} from 'esp-js';
import {PolimerTestApi, PolimerTestApiBuilder, StateHandlerConfig} from './testApi/testApi';
import {defaultTestStateFactory, EventConst, TestEvent, TestImmutableModel} from './testApi/testModel';
import {TestStateObjectHandler} from './testApi/stateHandlers';

describe('Event Observation', () => {
    let api: PolimerTestApi;

    describe('handler objects', () => {
        beforeEach(() => {
            api = PolimerTestApiBuilder.create()
                .withStateHandlers()
                .build();
            api.asserts.handlerObjectState.captureCurrentState();
            api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
        });

        afterEach(() => {
            api.asserts.handlerObjectState.stateInstanceHasChanged();
            api.asserts.immutableModelAsserts.immutableModelHasChanged();
        });

        it('can receives events at preview stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerObjectState
                .previewEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.preview);
        });

        it('can receives events at normal stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerObjectState
                .normalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.normal);
        });

        it('can receives events at committed stage', () => {
            let testEvent = api.actor.publishEventWhichCommitsAtNormalStage(EventConst.event1, 'handlerObjectState');
            api.asserts.handlerObjectState
                .committedEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.committed);
        });

        it('can receives events at final stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerObjectState
                .finalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.final);
        });

        it('can receives multiple events via same handler', () => {
            let event3 = api.actor.publishEvent(EventConst.event3);
            let event4 = api.actor.publishEvent(EventConst.event4);
            api.asserts.handlerObjectState
                .normalEvents()
                .eventCountIs(2)
                .callIs(0, EventConst.event3, event3, ObservationStage.normal)
                .callIs(1, EventConst.event4, event4, ObservationStage.normal);
        });
    });

    describe('handler models', () => {
        beforeEach(() => {
            api = PolimerTestApiBuilder.create()
                .withStateHandlerModel()
                .build();
            api.asserts.handlerModelState.captureCurrentState();
            api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
        });

        afterEach(() => {
            api.asserts.handlerModelState.stateInstanceHasChanged();
            api.asserts.immutableModelAsserts.immutableModelHasChanged();
        });

        it('can receives events at preview stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerModelState
                .previewEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.preview);
        });

        it('can receives events at normal stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerModelState
                .normalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.normal);
        });

        it('can receives events at committed stage', () => {
            let testEvent = api.actor.publishEventWhichCommitsAtNormalStage(EventConst.event1, 'handlerModelState');
            api.asserts.handlerModelState
                .committedEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.committed);
        });

        it('can receives events at final stage', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerModelState
                .finalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.final);
        });

        it('can receives multiple events via same handler', () => {
            let event3 = api.actor.publishEvent(EventConst.event3);
            let event4 = api.actor.publishEvent(EventConst.event4);
            api.asserts.handlerModelState
                .normalEvents()
                .eventCountIs(2)
                .callIs(0, EventConst.event3, event3, ObservationStage.normal)
                .callIs(1, EventConst.event4, event4, ObservationStage.normal);
        });
    });

    describe('handler compositions', () => {
        beforeEach(() => {
            api = PolimerTestApiBuilder.create()
                .withStateHandlers()
                .withStateHandlerModel()
                .build();
            api.asserts.handlerObjectState.captureCurrentState();
            api.asserts.handlerModelState.captureCurrentState();
            api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
        });

        afterEach(() => {
            api.asserts.handlerObjectState.stateInstanceHasChanged();
            api.asserts.handlerModelState.stateInstanceHasChanged();
            api.asserts.immutableModelAsserts.immutableModelHasChanged();
        });

        it('updates all states that observed the event', () => {
            let testEvent = api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerObjectState
                .normalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.normal);
            api.asserts.handlerModelState
                .normalEvents()
                .eventCountIs(1)
                .callIs(0, EventConst.event1, testEvent, ObservationStage.normal);
        });
    });

    describe('EventContext interactions', () => {
        describe('handler objects', () => {
            beforeEach(() => {
                api = PolimerTestApiBuilder.create()
                    .withStateHandlers()
                    .build();
            });

            it('can not cancel event within an event filter', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCancelsInEventFilter(EventConst.event5, 'handlerObjectState');
                    },
                    /You can't .* an event in an event filter\/predicate/
                );
            });

            it('can not commit an event within an event filter', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCommitsInEventFilter(EventConst.event5, 'handlerObjectState');
                    },
                    /You can't .* an event in an event filter\/predicate/
                );
            });

            it('can cancel an event at the preview stage', () => {
                const event = api.actor.publishEventWhichCancelsAtPreviewStage(EventConst.event1, 'handlerObjectState');
                api.asserts.handlerObjectState
                    .previewEvents().eventCountIs(1).callIs(0, EventConst.event1, event, ObservationStage.preview).end()
                    .normalEvents().eventCountIs(0).end()
                    .finalEvents().eventCountIs(0).end();
            });

            it('can not cancel an event at the normal stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCancelsAtNormalStage(EventConst.event1, 'handlerObjectState');
                    }
                );
            });

            it('can not cancel an event at the committed stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCancelsAtCommittedStage(EventConst.event1, 'handlerObjectState');
                    }
                );
            });

            it('can not cancel an event at the final stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCancelsAtFinalStage(EventConst.event1, 'handlerObjectState');
                    }
                );
            });

            it('can commit an event at the normal stage', () => {
                const event = api.actor.publishEventWhichCommitsAtNormalStage(EventConst.event1, 'handlerObjectState');
                api.asserts.handlerObjectState
                    .previewEvents().eventCountIs(1).callIs(0, EventConst.event1, event, ObservationStage.preview).end()
                    .normalEvents().eventCountIs(1).callIs(0, EventConst.event1, event, ObservationStage.normal).end()
                    .committedEvents().eventCountIs(1).callIs(0, EventConst.event1, event, ObservationStage.committed).end()
                    .finalEvents().eventCountIs(1).callIs(0, EventConst.event1, event, ObservationStage.final).end();
            });

            it('can not commit an event at the preview stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCommitsAtPreviewStage(EventConst.event1, 'handlerObjectState');
                    }
                );
            });

            it('can not commit an event at the committed stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCommitsAtCommittedStage(EventConst.event1, 'handlerObjectState');
                    },
                    /event .* for model .* is already committed/
                );
            });

            it('can not commit an event at the final stage', () => {
                api.asserts.throwsOnInvalidEventContextAction(
                    () => {
                        api.actor.publishEventWhichCommitsAtFinalStage(EventConst.event1, 'handlerObjectState');
                    }
                );
            });
        });
    });

    describe('Dispatch handler signature', () => {

        describe('handler objects', () => {
            beforeEach(() => {
                api = PolimerTestApiBuilder.create()
                    .withStateHandlers()
                    .build();
                api.asserts.handlerObjectState.captureCurrentState();
                api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
            });

            afterEach(() => {
                api.asserts.handlerObjectState.stateInstanceHasChanged();
            });

            it('dispatches event for each observation stage', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .eventCountIs(3)
                    .observationStageIs(0, ObservationStage.preview)
                    .observationStageIs(1, ObservationStage.normal)
                    .observationStageIs(2, ObservationStage.final);
            });

            it('receives the current state', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .stateIs(0, 'handlerObjectState');
            });

            it('receives the given event', () => {
                const event = api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .eventIs(0, event);
            });

            it('receives the current model', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .ensureModelReceived(0);
            });

            it('receives the event context', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .ensureEventContextReceived(0);
            });

            it('receives broadcast events', () => {
                const event = api.actor.broadcastEvent(EventConst.event1);
                api.asserts.handlerObjectState
                    .receivedEventsAll()
                    .eventIs(0, event);
            });
        });

        describe('handler models', () => {
            beforeEach(() => {
                api = PolimerTestApiBuilder.create()
                    .withStateHandlerModel()
                    .build();
                api.asserts.handlerModelState.captureCurrentState();
                api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
            });

            afterEach(() => {
                api.asserts.handlerModelState.stateInstanceHasChanged();
                api.asserts.immutableModelAsserts.immutableModelHasChanged();
            });

            it('dispatches event for each observation stage', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .eventCountIs(3)
                    .observationStageIs(0, ObservationStage.preview)
                    .observationStageIs(1, ObservationStage.normal)
                    .observationStageIs(2, ObservationStage.final);
            });

            it('receives the current state', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .stateIs(0, 'handlerModelState');
            });

            it('receives the given event', () => {
                const event = api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .eventIs(0, event);
            });

            it('receives the current model', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .ensureModelReceived(0);
            });

            it('receives the event context', () => {
                api.actor.publishEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .ensureEventContextReceived(0);
            });

            it('receives broadcast events', () => {
                const event = api.actor.broadcastEvent(EventConst.event1);
                api.asserts.handlerModelState
                    .receivedEventsAll()
                    .eventIs(0, event);
            });
        });
    });

    describe('Event Filters / Predicates', () => {
        it('can filter event', () => {
            api = PolimerTestApiBuilder.create()
                .withStateHandlerModel()
                .withStateHandlers()
                .build();
            api.asserts.handlerModelState.captureCurrentState();
            api.asserts.immutableModelAsserts.captureCurrentImmutableModel();

            api.actor.publishEventWhichFiltersAtPreviewStage(EventConst.event5);
            api.asserts.handlerModelState.receivedEventsAll().eventCountIs(0);
            api.asserts.handlerObjectState.receivedEventsAll().eventCountIs(0);
        });

        it('can filter via registration predicated', () => {
            let apiBuilder = PolimerTestApiBuilder.create();
            const handlers1 = [new TestStateObjectHandler({router: apiBuilder.router, stateHandlerName: 'h1.1'}), new TestStateObjectHandler({router: apiBuilder.router, stateHandlerName: 'h1.2'})];
            const handlers2 = [new TestStateObjectHandler({router: apiBuilder.router, stateHandlerName: 'h2.1'}), new TestStateObjectHandler({router: apiBuilder.router, stateHandlerName: 'h2.2'})];
            // Register 2 groups of handlers with different filters.
            const handlers: StateHandlerConfig[] = [
                {
                    state: 'handlerObjectState2',
                    deliveryPredicate: (e: EventEnvelope<TestEvent, TestImmutableModel>) => e.event.data === 'filterForFirstGroup',
                    stateHandlers: handlers1
                },
                {
                    state: 'handlerObjectState3',
                    deliveryPredicate: (e: EventEnvelope<TestEvent, TestImmutableModel>) => e.event.data === 'filterForSecondGroup',
                    stateHandlers: handlers2
                }
            ];
            api = apiBuilder
                .withStateHandlers(...handlers)
                .build();

            api.actor.publishEvent(EventConst.event1, {eventKey: 'myEvent', data: 'filterForFirstGroup'});
            // expect 2 events as each handler in group 1 will process the same event
            api.asserts.handlerObjectState2.normalEvents().eventCountIs(2)
                // make sure the right handlers did receive the event
                .handlerProcessingEventIs(0, 'h1.1')
                .handlerProcessingEventIs(1, 'h1.2');
            api.asserts.handlerObjectState3.normalEvents().eventCountIs(0);

            api.actor.publishEvent(EventConst.event1, {eventKey: 'myEvent', data: 'filterForSecondGroup'});
            // no change
            api.asserts.handlerObjectState2.normalEvents().eventCountIs(2);
            // expect 2 events as each handler in group 2 will process the same event
            api.asserts.handlerObjectState3.normalEvents().eventCountIs(2)
                // make sure the right handlers did receive the event
                .handlerProcessingEventIs(0, 'h2.1')
                .handlerProcessingEventIs(1, 'h2.2');

            // Publish something that doesn't match the filter, thus should not be delivered.
            api.actor.publishEvent(EventConst.event1, {eventKey: 'myEvent', data: 'no-match'});
            api.asserts.handlerObjectState2.normalEvents().eventCountIs(2);
            api.asserts.handlerObjectState3.normalEvents().eventCountIs(2);
        });
    });

    describe('State handler mutations', () => {
        beforeEach(() => {
            api = PolimerTestApiBuilder.create()
                .withStateHandlerModel()
                .withStateHandlers()
                .build();
            api.asserts.handlerModelState.captureCurrentState();
            api.asserts.handlerObjectState.captureCurrentState();
            api.asserts.immutableModelAsserts.captureCurrentImmutableModel();
        });

        it('mutative state changes result in a new state object', () => {
            api.actor.publishEvent(EventConst.event1);
            api.asserts.handlerModelState.stateInstanceHasChanged();
            api.asserts.handlerObjectState.stateInstanceHasChanged();
            api.asserts.immutableModelAsserts.immutableModelHasChanged();
        });

        it('can replace the state with a returned object', () => {
            const nextState = defaultTestStateFactory({/*'replacementState'*/});
            api.actor.publishEvent(EventConst.event5, {replacementState: nextState});
            api.asserts.handlerObjectState.stateInstanceHasChanged(nextState);
            api.asserts.handlerModelState.stateInstanceHasChanged(); // doesn't support swapping of state, doesn't use immer
            api.asserts.immutableModelAsserts.immutableModelHasChanged();
        });
    });
});