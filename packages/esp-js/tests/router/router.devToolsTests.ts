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

import {Router} from '../../src';

describe('Router Dev Tools', () => {

    let _router: Router;

    const setup = () => {
        _router = new Router();
        _router.addModel('modelId1', {});
        _router.getEventObservable('modelId1', 'startEvent').subscribe(() => {
        });
        _router.getModelObservable('modelId1').subscribe(m => {
        });
    };

    describe('dev tools enabled', () => {

        beforeEach(() => {
            setup();
        });

        it.skip('when router has dev tools enabled, events sent to dev tools', () => {

        });
    });

    describe('dev tools disabled', () => {

        beforeEach(() => {
            setup();
        });

        it.skip('when router has dev tools disabled, events not sent to dev tools', () => {

        });
    });
});