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

const baseConfig = require("../../webpack.config.base");
const webpack = require('webpack');

module.exports = {
    ...baseConfig,
    plugins:   [
        ...baseConfig.plugins,
        new webpack.DefinePlugin({
            self: 'this' // to enable the UMD to run in node
        }),
    ],
    output: {
        ...baseConfig.output,
        globalObject: 'this' // to enable the UMD to run in node
    },
    entry: {
        'esp-js-perf-test': './src/index.ts'
    }
};
