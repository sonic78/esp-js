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

import {switchMap} from 'rxjs/operators';
import {Router, observeEvent} from 'esp-js';
import {PolimerModel, ImmutableModel, PolimerModelBuilder, eventTransformFor, InputEventStream} from 'esp-js-polimer';
import { NEVER } from 'rxjs';

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
    StateHandler.prototype[eventTypeHandler] = (draft: { receivedEventCount: number }) => {
        draft.receivedEventCount = draft.receivedEventCount + 1;
    };
    observeEvent(
        `stateHandlerEvent${eventTypeSeed}`,
    )(StateHandler.prototype, eventTypeHandler);
}

class EventTransform {
}

for (let eventTypeSeed = 0; eventTypeSeed < 500; eventTypeSeed++) {
    const eventTypeHandler = `eventType${eventTypeSeed}Handler`;
    EventTransform.prototype[eventTypeHandler] = (obs: InputEventStream<any, any>) => obs.pipe(switchMap(() => NEVER));
    eventTransformFor(
        `eventTransformEvent${eventTypeSeed}`,
    )(EventTransform.prototype, eventTypeHandler, undefined);
}

interface MyModel extends ImmutableModel {
    state1: {
        receivedEventCount: number
    };
}

const router = new Router();

const createModels = (modelCount: number) => {
    console.log(`Creating models`);
    const models: Map<string, PolimerModel<MyModel>> = new Map();
    for (let modelIdSeed = 0; modelIdSeed < modelCount; modelIdSeed++) {
        const modelId = `modelId${modelIdSeed}`;
        models.set(
            modelId,
            PolimerModelBuilder.create<MyModel>(router)
                .withInitialModel({modelId, state1: { receivedEventCount: 0 }})
                .withStateHandlers('state1', new StateHandler())
                .withEventTransforms(new EventTransform())
                .registerWithRouter()
        );
    }
    return models;
};

const disposeModels = (models: Map<string, PolimerModel<MyModel>>) => {
    console.log(`Disposing models`);
    const disposeTimes = [];
    models.forEach(model => {
        let start = Date.now();
        model.dispose();
        disposeTimes.push(Date.now() - start);
    });
    console.log(`Dispose tiles: ${JSON.stringify(disposeTimes, null, 2)}`);
};

const raiseEvents = (eventType: 'stateHandler' | 'eventTransform', numberOfEvents: number, models: Map<string, PolimerModel<MyModel>>) => {
    console.log(`Raising ${numberOfEvents} '${eventType}' events against ${models.size} models`);
    const eventPublishTimes = [];
    const payload = {};
    models.forEach(model => {
        eventPublishTimes.push(`Model:${model.modelId}`);
        const start = Date.now();
        const startEventCount = model.getEspPolimerImmutableModel().state1.receivedEventCount;
        for (let i = 0; i < numberOfEvents; i++) {
            router.publishEvent(model.modelId, `${eventType}Event${i}`, payload);
        }
        if (eventType === 'stateHandler') {
            const endEventCount = model.getEspPolimerImmutableModel().state1.receivedEventCount;
            if ((startEventCount + numberOfEvents) !== endEventCount) {
                throw new Error(`AssertionError: Published events were not received by the model. startEventCount: ${startEventCount}, endEventCount: ${endEventCount}`);
            }
        }
        eventPublishTimes.push(Date.now() - start);
    });
    console.log(`Event ${eventType} publish times: ${JSON.stringify(eventPublishTimes, null, 2)}`);
};

const sleep = async (ms: number) => {
    console.log(`Sleeping for: ${ms}`);
    await new Promise(resolve => setTimeout(resolve, ms));
};

const polimerLargeModelTest = async () => {
    console.log(`Running polimer large model test`);

    const models = createModels(50);

    await sleep(2000);

    raiseEvents('stateHandler', 20, models);

    await sleep(2000);

    raiseEvents('eventTransform', 20, models);

    disposeModels(models);
};

polimerLargeModelTest().then(_ => console.log(`Done`));