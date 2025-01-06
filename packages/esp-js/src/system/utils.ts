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

import {Level} from './logging/types';

export namespace utils {
    export function removeAll<T>(arr: T[], item: T) {
        for (let i = arr.length; i--;) {
            if (arr[i] === item) {
                arr.splice(i, 1);
            }
        }
    }

    export function isString(value: any): value is string {
        return typeof value === 'string' || value instanceof String;
    }

    export function stringIsEmpty(value: any): value is string {
        return !value || value.length === 0 ;
    }

    export function isFunction(value: any): boolean {
        return typeof (value) === 'function';
    }

    export function startsWith(string: string, searchString: string, position: number = 0): boolean {
        return string.indexOf(searchString, position) === position;
    }

    export function getPropertyNames(object: any): string[] {
        let props = [];
        Object.getOwnPropertyNames(object).forEach(function (key) {
            props.push(key);
        });
        let proto = Object.getPrototypeOf(object);
        if (proto !== null && typeof proto === 'object') {
            let childProps = getPropertyNames(proto);
            for (let i = 0; i < childProps.length; i++) {
                props.push(childProps[i]);
            }
        }
        return props;
    }

    export const isObject = (value: any): value is object => {
        return typeof value === 'object' && value !== null;
    };

    export const pad10 = (n: number) => {
        return n < 10 ? '0'+n : n;
    };

    export const pad100 = (n: number) => {
        if (n < 10) { return '00'+n; }
        if (n < 100) { return '0'+n; }
        return n;
    };

    export const padOrTruncate = (v: string, length: number) => {
        if (v.length === length) {
            return v;
        }
        if (v.length > length) {
            return v.substring(0, length);
        }
        return v.padEnd(length);
    };

    export const getErrorText = (e: any) => {
        if (e instanceof Error) {
            return `Message: ${e.message}, Stack: ${e.stack || ''}`;
        }
        return e;
    };

    export const getLogLevelShorthand = (level: Level) => {
        switch (level) {
            case Level.verbose:
                return 'V';
            case Level.debug:
                return 'D';
            case Level.info:
                return 'I';
            case Level.warn:
                return 'W';
            case Level.error:
                return 'E';
            case Level.none:
                return '';
            default:
                throw new Error(`Unknown level ${level}`);
        }
    };
}