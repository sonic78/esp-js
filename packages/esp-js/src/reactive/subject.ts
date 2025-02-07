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
    private _observers = new Observers<T>();

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
            this._observers.runWork(observers => {
                for (const observer of observers) {
                    observer.onNext(item);
                }
            });
        }
    }

    onCompleted() {
        if (!this._hasComplete) {
            this._hasComplete = true;
            this._observers.runWork(observers => {
                for (const observer of observers) {
                    observer.onCompleted();
                }
            });
        }
    }

    getObserverCount() {
        return this._observers.size;
    }
}

function subscribe<T>(observer: Observer<T>) {
    this._observers.addObserver(observer);
    if (this._cacheLastValue && typeof this._lastValue !== 'undefined') {
        observer.onNext(this._lastValue);
    }
    return {
        dispose: () => {
            this._observers.removeObserver(observer);
        }
    };
}

/**
 *  Observers provides a gated approach to an internal data structure of observers.
 *  This allows us to pause adds/removes to the underlying observer list whist processing work on that list.
 *  We could take a copy of the observer list so adds/removes don't affect iterations of this list (i.e., add/remove mid-iteration).
 *  However, copying the list is not performant on large models.
 */
class Observers<T> {
    private _observers: Map<object, Observer<T>> = new Map();
    private _working = false;
    private _pendingAdds: Observer<T>[] = [];
    private _pendingRemoves: Observer<T>[] = [];
    public get size() {
        return this._observers.size;
    }

    public runWork = (work: (items: MapIterator<Observer<T>>) => void) => {
        if (this._working) {
            // If we happen to be already working, we just run the current request right now.
            // This is the same execution flow that happened before this performance optimisation was added.
            work(this._observers.values());
            // return and let the first entrant complete
            return;
        }
        this._working = true;
        try {
            work(this._observers.values());
        } finally {
            this._working = false;
        }
        if (this._pendingAdds.length > 0) {
            for (let i = 0, len = this._pendingAdds.length; i < len; i++) {
                this._observers.set(this._pendingAdds[i], this._pendingAdds[i]);
            }
            this._pendingAdds.length = 0;
        }
        if (this._pendingRemoves.length > 0) {
            for (let i = 0, len = this._pendingRemoves.length; i < len; i++) {
                this._observers.delete(this._pendingRemoves[i]);
            }
            this._pendingRemoves.length = 0;
        }
    }
    public addObserver(observer: Observer<T>) {
        if (this._working) {
            this._pendingAdds.push(observer);
        } else {
            this._observers.set(observer, observer);
        }
    }
    public removeObserver(observer: Observer<T>) {
        if (this._working) {
            this._pendingRemoves.push(observer);
        } else {
            this._observers.delete(observer);
        }
    }
}