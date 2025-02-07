// notice_start
/*
 * Copyright 2015 Dev Shop Limited
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

import {Observable} from 'rxjs';
import {Router, observeEvent} from 'esp-js';
import {PolimerModel, ImmutableModel, PolimerModelBuilder, eventTransformFor} from 'esp-js-polimer';

// Here we dynamically create an event Transform object with 500 handlers.
// We're creating a structure like this:
//
// class StateHandler{
//      @observeEvent('eventType0')
//      eventType0Handler() {}
//
//      ... another 499 handlers
// }
//
// You'd never write such code in a real app.
// This is just to emulate the underlying mechanics with large models.
class StateHandler {
}

for (let eventTypeSeed = 0; eventTypeSeed < 500; eventTypeSeed++) {
    const eventTypeHandler = `eventType${eventTypeSeed}Handler`;
    StateHandler.prototype[eventTypeHandler] = () => {
    };
    observeEvent(
        `eventType${eventTypeSeed}`,
    )(StateHandler.prototype, eventTypeHandler);
}

class EventTransform {
}

for (let eventTypeSeed = 0; eventTypeSeed < 500; eventTypeSeed++) {
    const eventTypeHandler = `eventType${eventTypeSeed}Handler`;
    EventTransform.prototype[eventTypeHandler] = (obs: Observable<any>) => obs;
    eventTransformFor(
        `eventType${eventTypeSeed}`,
    )(EventTransform.prototype, eventTypeHandler, undefined);
}

interface MyModel extends ImmutableModel {
    state1: {};
}

export const polimerLargeModelDisposalTest = () => {
    let router = new Router();
    const models: Map<string, PolimerModel<MyModel>> = new Map();
    for (let modelIdSeed = 0; modelIdSeed < 100; modelIdSeed++) {
        const modelId = `modelId${modelIdSeed}`;
        models.set(
            modelId,
            PolimerModelBuilder.create<MyModel>(router)
                .withInitialModel({modelId, state1: {}})
                .withStateHandlers('state1', new StateHandler())
                .withEventTransforms(new EventTransform())
                .registerWithRouter()
        );
    }
    const disposeTimes = [];
    models.forEach(model => {
        let start = Date.now();
        model.dispose();
        disposeTimes.push(Date.now() - start);
    });
    console.log(JSON.stringify(disposeTimes));
};

polimerLargeModelDisposalTest();