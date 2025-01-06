// notice_start
/*
 * Copyright 2018 Keith Woods
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

import * as espReact from '../src/index';

describe('index exports', () => {
    it('check exports', () => {
        expect(espReact.viewBinding).toBeDefined();
        expect(espReact.ViewBinder).toBeDefined();
        expect(espReact.DEFAULT_VIEW_KEY).toBeDefined();
        expect(espReact.createViewForModel).toBeDefined();
        expect(espReact.connect).toBeDefined();
        expect(espReact.ConnectableComponent).toBeDefined();
        expect(espReact.useSyncModelWithSelector).toBeDefined();
        expect(espReact.syncModelWithSelectorOptions).toBeDefined();
        expect(espReact.RouterProvider).toBeDefined();
        expect(espReact.EspRouterContextProvider).toBeDefined();
        expect(espReact.RouterContext).toBeDefined();
        expect(espReact.useRouter).toBeDefined();
        expect(espReact.PublishEventContext).toBeDefined();
        expect(espReact.usePublishEvent).toBeDefined();
        expect(espReact.useGetModelId).toBeDefined();
        expect(espReact.GetModelIdContext).toBeDefined();
        expect(espReact.useGetModel).toBeDefined();
        expect(espReact.GetModelContext).toBeDefined();
        expect(espReact.PublishModelEventContext).toBeDefined();
        expect(espReact.usePublishModelEvent).toBeDefined();
        expect(espReact.PublishModelEventWithEntityKeyContext).toBeDefined();
        expect(espReact.usePublishModelEventWithEntityKey).toBeDefined();
        expect(espReact.EspModelContextProvider).toBeDefined();
    });
});