import {EventContext, observeEvent} from 'esp-js';

export type TestModelImmutableState = { value: string, modelId: string, entityKey: string };

export class TestModel {

    private _internalState: TestModelImmutableState;

    constructor(modelId: string) {
        this._internalState = {
            value: 'initial-value',
            entityKey: '',
            modelId: modelId,
        };
    }

    public get state(): TestModelImmutableState {
        return this._internalState;
    }

    @observeEvent('test-event')
    _onTestEvent(ev: string) {
        // mimic some immutable logic that would be provided by a lib such as immer in a real app.
        this._internalState = {
            ...this._internalState,
            value: ev
        };
    }

    @observeEvent('test-event-with-entity-key')
    _onTestEventWithEntityKey(ev: string, eventContext: EventContext) {
        // mimic some immutable logic that would be provided by a lib such as immer in a real app.
        this._internalState = {
            ...this._internalState,
            entityKey: eventContext.entityKey,
            value: ev
        };
    }

    public getEspPolimerImmutableModel() {
        return this._internalState;
    }
}