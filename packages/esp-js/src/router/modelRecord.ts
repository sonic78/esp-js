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
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 // notice_end

import {PreEventProcessor} from './eventProcessors';
import {EventDispatchProcessor, EventProcessors, PostEventProcessor} from './eventProcessors';
import {Observable} from '../reactive';
import {DispatchType, EventEnvelope, ModelEnvelope} from './envelopes';
import {AutoConnectedObservable} from '../reactive/autoConnectedObservable';
import {Guard} from '../system';
import {ObservationStage} from './index';

export interface EventStreamsRegistration {
    all: AutoConnectedObservable<EventEnvelope<any, any>>;
    preview: AutoConnectedObservable<EventEnvelope<any, any>>;
    normal: AutoConnectedObservable<EventEnvelope<any, any>>;
    committed: AutoConnectedObservable<EventEnvelope<any, any>>;
    final: AutoConnectedObservable<EventEnvelope<any, any>>;
}

export type EventRecord = {entityKey: string, eventType: string, event: any, action:  (model: any) => void};

interface InternalEventStreamsRegistration {
    streams: EventStreamsRegistration;
}

export class ModelRecord {
    private readonly _modelId: string;
    private readonly _modelObservationStream: AutoConnectedObservable<ModelEnvelope<any>>;
    private readonly _eventQueue: EventRecord[];
    private _model: any;
    private _hasReceivedEvent: boolean;
    private _wasRemoved: boolean;
    private _preEventProcessor: PreEventProcessor;
    private _eventDispatchProcessor: EventDispatchProcessor;
    private _eventDispatchedProcessor: EventDispatchProcessor;
    private _postEventProcessor: PostEventProcessor;
    private _eventStreams: Map<string, InternalEventStreamsRegistration>;
    private _eventQueueDirtyEpochMs: number;

    constructor(modelId: string, model: any, modelObservationStream: AutoConnectedObservable<ModelEnvelope<any>>, options?: EventProcessors) {
        this._modelId = modelId;
        this._eventQueue = [];
        this._hasReceivedEvent = false;
        this._wasRemoved = false;
        this._eventStreams = new Map();
        this._modelObservationStream = modelObservationStream;
        this._eventQueueDirtyEpochMs = null;

        if (model) {
            this.setModel(model, options);
        }
    }
    public get modelId() {
        return this._modelId;
    }
    public get hasModel() {
        return !!this._model;
    }
    public get model() {
        return this._model;
    }
    public get eventQueue() {
        return this._eventQueue;
    }
    public get eventQueueDirtyEpochMs() {
        return this._eventQueueDirtyEpochMs;
    }
    public get hasReceivedEvent() {
        return this._hasReceivedEvent;
    }
    public set hasReceivedEvent(value) {
        this._hasReceivedEvent = value;
    }
    public get wasRemoved() {
        return this._wasRemoved;
    }
    public set wasRemoved(value) {
        this._wasRemoved = value;
    }
    public get preEventProcessor(): PreEventProcessor {
        return this._preEventProcessor;
    }
    public get eventDispatchProcessor(): EventDispatchProcessor {
        return this._eventDispatchProcessor;
    }
    public get eventDispatchedProcessor(): EventDispatchProcessor {
        return this._eventDispatchedProcessor;
    }
    public get postEventProcessor(): PostEventProcessor {
        return this._postEventProcessor;
    }
    public getOrCreateEventStreamsRegistration(eventType: string, dispatchObservable: Observable<EventEnvelope<any, any>>): EventStreamsRegistration {
        let eventStreamsRegistration = this._eventStreams.get(eventType);
        if (!eventStreamsRegistration) {
            const modelStream = dispatchObservable.filter(
                envelope => envelope.modelId === this.modelId
            ).share(false);
            const eventStream =  modelStream.filter(
                envelope =>
                    envelope.dispatchType === DispatchType.Event &&
                    envelope.eventType === eventType
            ).share(false);
            eventStreamsRegistration = {
                streams: {
                    preview: eventStream
                        .filter(envelope => ObservationStage.isPreview(envelope.observationStage))
                        .share(false),
                    normal: eventStream
                        .filter(envelope => ObservationStage.isNormal(envelope.observationStage))
                        .share(false),
                    committed: eventStream
                        .filter(envelope => ObservationStage.isCommitted(envelope.observationStage))
                        .share(false),
                    final: eventStream
                        .filter(envelope => ObservationStage.isFinal(envelope.observationStage))
                        .share(false),
                    all: eventStream
                        .share(false)
                }
            };
            // there is no real reason to cache these stream filters other than less objects get created at runtime
            // that's a handy enough reason to aid in debugging and overall performance
            this._eventStreams.set(eventType, eventStreamsRegistration);
        }
        return eventStreamsRegistration.streams;
    }
    public tryEnqueueEvent(entityKey: string, eventType: string, event: any): boolean {
        if (!this._eventStreams.has(eventType)) {
            return false;
        }
        if (!this._eventQueueDirtyEpochMs) {
            this._eventQueueDirtyEpochMs = Date.now();
        }
        this.eventQueue.push({entityKey, eventType: eventType, event: event, action: null});
        return true;
    }
    public eventQueuePurged() {
        this._eventQueueDirtyEpochMs = null;
    }
    public get modelObservationStream(): Observable<any>  {
        return this._modelObservationStream;
    }
    public setModel(model: any, eventProcessors?: EventProcessors) {
        Guard.isFalsey(this._model, 'Model already set');
        this._model = model;
        if (this._model) {
            this._preEventProcessor = this._createEventProcessor('preProcess', 'preEventProcessor', eventProcessors);
            this._eventDispatchProcessor = this._createEventDispatchProcessor('eventDispatch', 'eventDispatchProcessor', eventProcessors);
            this._eventDispatchedProcessor = this._createEventDispatchProcessor('eventDispatched', 'eventDispatchedProcessor', eventProcessors);
            this._postEventProcessor = this._createEventProcessor('postProcess', 'postEventProcessor', eventProcessors);
        }
    }
    public dispose() {
        this._eventQueue.length = 0;
        this._modelObservationStream.disconnect();
        this._eventStreams.forEach(streamsRegistration => {
            streamsRegistration.streams.preview.disconnect();
            streamsRegistration.streams.normal.disconnect();
            streamsRegistration.streams.committed.disconnect();
            streamsRegistration.streams.all.disconnect();
        });
    }
    /**
     * Creates an event processor which can be given as externalProcessor, or exist on the model as modelProcessFunctionName (or both).
     * If no such process exists a no-op function is returned
     */
    _createEventProcessor(modelProcessFunctionName: string, optionsProcessFunctionName: string, eventProcessors: EventProcessors):  (model: any, eventsProcessed?: string[]) => void {
        let processorFunctionOnOptions: (model: any, eventsProcessed?: string[]) => void;
        if (eventProcessors && eventProcessors[optionsProcessFunctionName]) {
            Guard.isFunction(eventProcessors[optionsProcessFunctionName], `${optionsProcessFunctionName} on the model options exists but is not a function`);
            processorFunctionOnOptions = eventProcessors[optionsProcessFunctionName];
        } else {
            processorFunctionOnOptions = (model, eventsProcessed) => { /*noop */ };
        }
        let modelProcessor = (model, eventsProcessed) => {
            // dispatch to the model in a late bound manor
            if(model[modelProcessFunctionName] && (typeof model[modelProcessFunctionName] === 'function')) {
                model[modelProcessFunctionName](eventsProcessed);
            }
        };
        return (model, eventsProcessed) => {
            processorFunctionOnOptions(model, eventsProcessed);
            modelProcessor(model, eventsProcessed);
        };
    }
    /**
     * Creates an event dispatch processor which can exist on the given options as `optionsEventDispatchFunctionName` and/or on the model as `modelEventDispatchFunctionName`.
     * If no such process exists a no-op function is returned
     */
    _createEventDispatchProcessor<TDelegate>(modelEventDispatchFunctionName: string, optionsEventDispatchFunctionName: string, options: EventProcessors):  EventDispatchProcessor {
        let processorFunctionOnOptions: EventDispatchProcessor;
        if (options && options[optionsEventDispatchFunctionName]) {
            Guard.isFunction(options[optionsEventDispatchFunctionName], `${optionsEventDispatchFunctionName} on the model options exists but is not a function`);
            processorFunctionOnOptions = options[optionsEventDispatchFunctionName];
        } else {
            processorFunctionOnOptions = (model: any, eventType: string, event: any, observationStage: ObservationStage) => { /*noop */ };
        }
        let modelProcessor = (model, eventType: string, event: any, observationStage: ObservationStage) => {
            // dispatch to the model in a late bound manor
            if(model[modelEventDispatchFunctionName] && (typeof model[modelEventDispatchFunctionName] === 'function')) {
                model[modelEventDispatchFunctionName](eventType, event, observationStage);
            }
        };
        return (model: any, eventType: string, event: any, observationStage: ObservationStage) => {
            processorFunctionOnOptions(model, eventType, event, observationStage);
            modelProcessor(model, eventType, event, observationStage);
        };
    }
}