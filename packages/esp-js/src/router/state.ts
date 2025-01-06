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

import {Guard} from '../system';
import {Status} from './status';
import {ModelRecord} from './modelRecord';

// note: perhaps some validation on state transition could be added here, but the tests cover most edges cases already
export class State {
    private _currentStatus: string;
    private _eventsDispatched: any[];
    private _currentModelId: string;
    private _currentModelRecord: ModelRecord;
    private _circularEventDispatchLimit = 10000;
    private _currentDispatchCount = 0;

    public constructor() {
        this._currentStatus = Status.Idle;
        this._eventsDispatched = [];
    }

    public get currentStatus(): Status {
        return this._currentStatus;
    }

    public get currentModelId(): string {
        return this._currentModelId;
    }

    public get currentModelRecord(): ModelRecord {
        return this._currentModelRecord;
    }

    public get eventsProcessed(): string[] {
        return this._eventsDispatched;
    }

    public moveToIdle() {
        this._currentStatus = Status.Idle;
        this._clear();
        this._currentDispatchCount = 0;
    }

    public moveToPreProcessing(modelId: string, modelRecord: ModelRecord) {
        Guard.isString(modelId, 'modelId should be a string');
        Guard.isDefined(modelRecord, 'modelRecord should be defined');
        this._currentModelId = modelId;
        this._currentModelRecord = modelRecord;
        this._currentStatus = Status.PreEventProcessing;
    }

    public moveToEventDispatch() {
        this._currentDispatchCount++;
        if (this._currentDispatchCount >= this._circularEventDispatchLimit) {
            throw new Error(`Circular event dispatch detected, dispatch loop halted. ${this._currentDispatchCount}.`);
        }
        this._currentStatus = Status.EventProcessorDispatch;
    }

    public moveToPostProcessing() {
        this._currentStatus = Status.PostProcessing;
    }

    public executeEvent(executeAction: () => void) {
        let canMove = this._currentStatus === Status.PreEventProcessing || this._currentStatus === Status.EventProcessorDispatch || this._currentStatus === Status.PostProcessing;
        Guard.isTruthy(canMove, 'Can\'t move to executing as the current state ' + this._currentStatus + ' doesn\'t allow it');
        let previousStatus = this._currentStatus;
        this._currentStatus = Status.EventExecution;
        executeAction();
        this._currentStatus = previousStatus;
    }

    public moveToDispatchModelUpdates() {
        this._currentStatus = Status.DispatchModelUpdates;
    }

    public moveToHalted() {
        this._currentStatus = Status.Halted;
        this._clear();
    }

    public clearEventDispatchQueue() {
        this._eventsDispatched = [];
    }

    private _clear() {
        this._currentModelId = undefined;
        this._currentModelRecord = undefined;
        this.clearEventDispatchQueue();
    }
}