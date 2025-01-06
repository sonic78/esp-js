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

import {EventEnvelope, Router} from '../../src';

describe('Router', () => {

    let _router;

    beforeEach(() => {
        _router = new Router();
    });

    describe('.broadcast()', function() {
        it('throws if arguments incorrect', () => {
            expect(() => {_router.broadcastEvent(undefined, 'foo'); }).toThrow();
            expect(() => {_router.broadcastEvent('anEvent', undefined); }).toThrow();
        });

        it('should deliver the event to all models observing event', () => {
            let model1ProcessorReceived = 0, model2ProcessorReceived = 0;
            _router.addModel('modelId1', {});
            _router.addModel('modelId2', {});
            _router.getEventObservable('modelId1', 'Event1').subscribe(({event}) => {
                model1ProcessorReceived+=event;
            });
            _router.getEventObservable('modelId2', 'Event1').subscribe(({event}) => {
                model2ProcessorReceived+=event;
            });
            _router.broadcastEvent('Event1', 10);
            expect(model1ProcessorReceived).toEqual(10);
            expect(model2ProcessorReceived).toEqual(10);
        });

        it('should not deliver the event to models not observing event', () => {
            let model1ProcessorReceivedCount = 0, model2ProcessorReceivedCount = 0, receivedEvents: EventEnvelope<any, any>[] = [];
            _router.addModel('modelId1', {});
            _router.addModel('modelId2', {});
            // first subscribe model 1 to the event
            _router.getEventObservable('modelId1', 'Event1').subscribe(({event}) => {
                model1ProcessorReceivedCount++;
            });
            _router.getAllEventsObservable().subscribe((envelope: EventEnvelope<any, any>) => {
                receivedEvents.push(envelope);
            });

            _router.broadcastEvent('Event1', 10);
            expect(model1ProcessorReceivedCount).toEqual(1);
            expect(receivedEvents.length).toEqual(1);
            expect(receivedEvents[0].modelId).toEqual('modelId1');
            expect(receivedEvents[0].eventType).toEqual('Event1');

            // now subscribe model 2
            _router.getEventObservable('modelId2', 'Event1').subscribe(({event}) => {
                model2ProcessorReceivedCount++;
            });

            _router.broadcastEvent('Event1', 20);
            expect(model1ProcessorReceivedCount).toEqual(2);
            expect(model2ProcessorReceivedCount).toEqual(1);
            expect(receivedEvents.length).toEqual(3);
            expect(receivedEvents[1].modelId).toEqual('modelId1');
            expect(receivedEvents[2].modelId).toEqual('modelId2');
            expect(receivedEvents[2].eventType).toEqual('Event1');
        });
    });
});