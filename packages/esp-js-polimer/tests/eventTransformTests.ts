import {EventTransformConfig, PolimerTestApi, PolimerTestApiBuilder} from './testApi/testApi';
import {EventConst, TestEvent, TestImmutableModel} from './testApi/testModel';
import {ObservationStage, EventEnvelope} from 'esp-js';
import {ObjectEventTransformsSpy} from './testApi/eventTransforms';

describe('Event Transforms', () => {
    let api: PolimerTestApi;
    let model2: {};
    let receivedEvents: EventEnvelope<TestEvent, any>[];

    const setup = (eventTransforms: EventTransformConfig[] = []) => {
        api = PolimerTestApiBuilder.create()
            .withStateHandlers()
            .withEventTransforms(...eventTransforms)
            .build();
        model2 = {};
        receivedEvents = [];
        api.router.addModel('model2', model2);
        api.router.getEventObservable('model2', EventConst.event8).subscribe(eventEnvelope => {
            receivedEvents.push(eventEnvelope);
        });
    };

    describe('Event delivery', () => {
        it('Transformed events are published to the model', () => {
            setup();
            // the event transforms will publish event8 back to the model
            let event = api.actor.publishEvent(EventConst.event7, {eventKey: 'myEvent'});
            let asserts = api.asserts.handlerObjectState.normalEvents();
            asserts.eventCountIs(2);
            asserts.callIs(0, EventConst.event7, event, ObservationStage.normal);
            // now test the transformed event, which is at index 1
            asserts
                .eventTypeIs(1, EventConst.event8)
                .observationStageIs(1, ObservationStage.normal)
                .eventKeyIs(1, 'myEvent')
                .eventTransformedKeyIs(1, 'transformedEvent_event7');
        });

        it('Transformed events are published to specific model', () => {
            setup();

            // the event transforms will publish event8 back to the model
            api.actor.publishEvent(EventConst.eventNotObservedByModel, {eventKey: 'myEvent', publishToModelId: 'model2'});
            api.asserts.handlerObjectState.normalEvents().eventCountIs(0);
            expect(receivedEvents.length).toEqual(1);
            expect(receivedEvents[0].event.transformedEventKey).toEqual('transformedEvent_eventNotObservedByModel');
        });

        it.skip('Transformed events can omit target model Id and it will publish to the current model', () => {
            // The testing framework is making it difficult to test this case (without much more confusing test model updates).
            // We need to isolate the esp Router, then assert how polimer intetracts with it.
            // Currently, we're hitting the router and asserting against the output, thus also testing the Router.
        });

        it.skip('Transformed events can specify an address but omit target model Id and it will publish to the current model', () => {
            // The testing framework is making it difficult to test this case (without much more confusing test model updates).
            // We need to isolate the esp Router, then assert how polimer intetracts with it.
            // Currently, we're hitting the router and asserting against the output, thus also testing the Router.
        });
    });

    it('Transformation stream receives event even when no state handler observing event', () => {
        setup();
        // the event transforms will publish event8 back to the model
        api.actor.publishEvent(EventConst.eventNotObservedByModel, {eventKey: 'myEvent'});
        // now test the transformed event, which is at index 1
        api.asserts.handlerObjectState.normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event8)
            .observationStageIs(0, ObservationStage.normal)
            .eventKeyIs(0, 'myEvent')
            .eventTransformedKeyIs(0, 'transformedEvent_eventNotObservedByModel');
    });

    it('Event transforms can be filtered at registration time', () => {
        const spys1 = [new ObjectEventTransformsSpy(), new ObjectEventTransformsSpy()];
        const spys2 = [new ObjectEventTransformsSpy(), new ObjectEventTransformsSpy()];
        setup([
            {
                deliveryPredicate: (e: EventEnvelope<TestEvent, TestImmutableModel>) => e.event.data === 'spy1',
                transforms: spys1
            },
            {
                deliveryPredicate: (e: EventEnvelope<TestEvent, TestImmutableModel>) => e.event.data === 'spy2',
                transforms: spys2
            },
        ]);
        api.actor.publishEvent(EventConst.event1, {eventKey: 'myEvent', data: 'spy1'});
        expect(spys1[0].receivedEvents.length).toBe(1);
        expect(spys1[1].receivedEvents.length).toBe(1);
        expect(spys2[0].receivedEvents.length).toBe(0);
        expect(spys2[1].receivedEvents.length).toBe(0);

        api.actor.publishEvent(EventConst.event1, {eventKey: 'myEvent', data: 'spy2'});
        expect(spys1[0].receivedEvents.length).toBe(1);
        expect(spys1[1].receivedEvents.length).toBe(1);
        expect(spys2[0].receivedEvents.length).toBe(1);
        expect(spys2[1].receivedEvents.length).toBe(1);
    });
});