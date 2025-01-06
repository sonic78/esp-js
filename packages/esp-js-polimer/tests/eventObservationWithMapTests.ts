import {Router} from 'esp-js';
import {TestStateObjectHandler, TestStateObjectHandlerForMapState} from './testApi/stateHandlers';
import {defaultModelFactory, defaultTestStateFactory, EventConst, TestImmutableModel} from './testApi/testModel';
import {ImmutableModelAsserts, MapStateAsserts} from './testApi/testApi';

describe('Map Tests', () => {
    let router: Router;
    let modelId: string;

    beforeEach(() => {
        router = new Router();
        modelId = 'modelId';
    });

    it('Can publish to Map without entityKey and get full map', () => {
        let stateHandlerSpy = new TestStateObjectHandlerForMapState();
        let polimerModel = router
            .modelBuilder<TestImmutableModel>()
            .withInitialModel(defaultModelFactory(modelId))
            .withStateHandlers('testMapState', stateHandlerSpy)
            .registerWithRouter();

        let mapStateAsserts = new MapStateAsserts(() => polimerModel.getImmutableModel().testMapState);
        mapStateAsserts.sizeIs(3);

        mapStateAsserts.captureCurrentState();
        router.publishEvent(
            {modelId: 'modelId'},
            EventConst.event1,
            { newKey: 'id-new', testState: defaultTestStateFactory({stateName: 'new-state-name'})}
        );
        mapStateAsserts.stateInstanceHasChanged();

        mapStateAsserts.sizeIs(4);
        mapStateAsserts
            .entity('id-new')
            .stateNameIs('new-state-name');
    });

    it('Can publish event with entityKey to Map state - specific state handler instance case', () => {
        let polimerModel = router
            .modelBuilder<TestImmutableModel>()
            .withInitialModel(defaultModelFactory(modelId))
            // In this example, we're making each handler unique to the entity.
            // We give the handler some specific state, then register it and filter any events using this same state (i.e. the entityKey)
            .withStateHandlers('testMapState', (ee) => ee.entityKey === 'id-1', new TestStateObjectHandler({router, entityKeyOfHandler: 'id-1' }))
            .withStateHandlers('testMapState', (ee) => ee.entityKey === 'id-2', new TestStateObjectHandler({router, entityKeyOfHandler: 'id-2' }))
            .withStateHandlers('testMapState', (ee) => ee.entityKey === 'id-3', new TestStateObjectHandler({router, entityKeyOfHandler: 'id-3' }))
            .registerWithRouter();

        const mapStateAsserts = new MapStateAsserts(() => polimerModel.getImmutableModel().testMapState);
        const state1Asserts = mapStateAsserts.entity('id-1').captureCurrentState();
        const state2Asserts = mapStateAsserts.entity('id-2').captureCurrentState();
        const state3Asserts = mapStateAsserts.entity('id-3').captureCurrentState();

        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-1'}, EventConst.event1, {data: 'the-data1'});
        mapStateAsserts.stateInstanceHasChanged();

        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-2'}, EventConst.event1, {data: 'the-data2'});
        mapStateAsserts.stateInstanceHasChanged();

        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-3'}, EventConst.event1, {data: 'the-data3'});
        mapStateAsserts.stateInstanceHasChanged();

        state1Asserts
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-1')
            .eventIs(0, e => e.data === 'the-data1');

        state2Asserts
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-2')
            .eventIs(0, e => e.data === 'the-data2');

        state3Asserts
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-3')
            .eventIs(0, e => e.data === 'the-data3');
    });

    // This test is very similar to the above, however, we have a single handler handling all events
    it('Can publish event with entityKey to Map state - shared state handler instance case', () => {
        let polimerModel = router
            .modelBuilder<TestImmutableModel>()
            .withInitialModel(defaultModelFactory(modelId))
            .withStateHandlers('testMapState', new TestStateObjectHandler({router}))
            .registerWithRouter();

        let immutableModelAsserts = new ImmutableModelAsserts(polimerModel);
        let mapStateAsserts = new MapStateAsserts(() => polimerModel.getImmutableModel().testMapState);
        let state1Asserts = mapStateAsserts.entity('id-1').captureCurrentState();
        let state2Asserts = mapStateAsserts.entity('id-2').captureCurrentState();
        let state3Asserts = mapStateAsserts.entity('id-3').captureCurrentState();

        immutableModelAsserts.captureCurrentImmutableModel();
        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-1'}, EventConst.event1, {data: 'the-data1'});
        // make sure the Map itself has been mutated
        mapStateAsserts.stateInstanceHasChanged();
        immutableModelAsserts.immutableModelHasChanged();

        immutableModelAsserts.captureCurrentImmutableModel();
        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-2'}, EventConst.event1, {data: 'the-data2'});
        mapStateAsserts.stateInstanceHasChanged();
        immutableModelAsserts.immutableModelHasChanged();

        immutableModelAsserts.captureCurrentImmutableModel();
        mapStateAsserts.captureCurrentState();
        router.publishEvent({modelId: 'modelId', entityKey: 'id-3'}, EventConst.event1, {data: 'the-data3'});
        mapStateAsserts.stateInstanceHasChanged();
        immutableModelAsserts.immutableModelHasChanged();

        state1Asserts
            // make sure the item in the map has been mutated
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-1')
            .eventIs(0, e => e.data === 'the-data1');

        state2Asserts
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-2')
            .eventIs(0, e => e.data === 'the-data2');

        state3Asserts
            .stateInstanceHasChanged()
            .normalEvents()
            .eventCountIs(1)
            .eventTypeIs(0, EventConst.event1)
            .eventEntityKey(0,'id-3')
            .eventIs(0, e => e.data === 'the-data3');
    });
});