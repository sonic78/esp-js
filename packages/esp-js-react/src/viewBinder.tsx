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

import * as React from 'react';
import {createViewForModel} from './viewBindingDecorator';
import {useRouter} from './espRouterContextProvider';

export interface ViewBinderProps {
    model: any;
    viewContext?: string;
    /**
     * ...rest props, these will be passed to the child
     */
    [key: string]: any;
}

/**
 * Takes a model with a @viewBinding decorator and dynamically crates the view specified by the decorator
 */
export const ViewBinder: React.FC<ViewBinderProps> = ({model, viewContext, ...rest}) => {
    if (model) {
        const router = useRouter();
        const newProps = {
            model,
            router,
            ...rest
        };
        return createViewForModel(
            model,
            newProps,
            viewContext,
            null
        );
    }
    return null;
};