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

import {Observable} from './observable';
import {Observer} from './observer';
import {Subscribe} from './subscribeDelegate';

export class Subject<T> extends Observable<T> {
    private readonly _cacheLastValue: boolean;
    private _lastValue: any;
    private _hasComplete: boolean;
    private _observers: Map<object, Observer<T>> = new Map();

    constructor(cacheLastValue = false) {
        super(undefined);
        this._cacheLastValue = cacheLastValue;
        this._lastValue = undefined;
        this._hasComplete = false;
        // the base object Observable requires _subscribe to be bound to this.
        this._subscribe = <Subscribe<T>>subscribe.bind(this);
    }

    onNext(item: T) {
        if (!this._hasComplete) {
            if (this._cacheLastValue) {
                this._lastValue = item;
            }
            for (const observer of this._observers.values()) {
                observer.onNext(item);
            }
        }
    }

    onCompleted() {
        if (!this._hasComplete) {
            this._hasComplete = true;
            for (const observer of this._observers.values()) {
                observer.onCompleted();
            }
        }
    }

    getObserverCount() {
        return this._observers.size;
    }
}

function subscribe<T>(observer: Observer<T>) {
    this._observers.set(observer, observer);
    if (this._cacheLastValue && typeof this._lastValue !== 'undefined') {
        observer.onNext(this._lastValue);
    }
    return {
        dispose: () => {
            this._observers.delete(observer);
        }
    };
}