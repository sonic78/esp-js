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

import {DiagnosticMonitor} from './diagnosticMonitor';
import {DisposableBase} from '../../system/disposables';
import { ModelAddress } from '../modelAddress';

export class NoopDiagnosticMonitor extends DisposableBase implements DiagnosticMonitor {
    addModel(modelId: string): void {
        
    }
    removeModel(modelId: string): void {
        
    }
    publishEvent(modelIdOrModelAddress: string | ModelAddress, eventType: string, event: string): void {
        
    }
    broadcastEvent(eventType: string): void {
        
    }
    executingEvent(eventType: string): void {
        
    }
    runAction(modelId: string): void {
        
    }
    eventEnqueued(modelId: string, entityKey: string, eventType: string): void {
        
    }
    dispatchLoopStart(): void {
        
    }
    startingModelEventLoop(modelId: string, entityKey: string, initiatingEventType: string): void {
        
    }
    preProcessingModel(): void {
        
    }
    dispatchingEvents(): void {
        
    }
    dispatchingAction(): void {
        
    }
    dispatchingEvent(eventType: string, stage: string): void {
        
    }
    dispatchingViaDirective(functionName: string): void {
        
    }
    finishDispatchingEvent(): void {
        
    }
    postProcessingModel(): void {
        
    }
    endingModelEventLoop(): void {
        
    }
    dispatchingModelUpdates(modelId: string, model: any): void {
        
    }
    dispatchLoopEnd(): void {
        
    }
    halted(modelIds: string[], err: string): void {
        
    }
}