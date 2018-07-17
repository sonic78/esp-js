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

import {Subject} from './Subject';
import {RouterObservable} from './RouterObservable';
import {Router} from '../router';

export class RouterSubject<T> extends Subject<T> {
    private _router: Router;

    constructor(router) {
        super();
        this._router = router;
    }

    asRouterObservable(router : Router): RouterObservable<T> {
        let source = this;
        let subscribe = observer => source.subscribe(observer);
        return new RouterObservable<T>(router || this._router, subscribe);
    }
}