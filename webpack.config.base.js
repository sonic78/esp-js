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
/*eslint-env node */
'use strict';

const webpack = require('webpack');
const path  = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const PeerDepsExternalsPlugin = require('./webpack/peerDepsExternalsPlugin');
const logger = require('webpack-log')({ name: 'BaseConfig' });
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const env = process.env.NODE_ENV || 'dev';
const isProduction = env.trim().toLowerCase() === 'prod';
const mode = isProduction ? 'production' : 'development';

logger.info('Running for env:' + process.env.NODE_ENV);

const config = {
    mode: mode,
    output: {
        library: {
            name: path.basename(process.cwd()),
            type: 'umd'
        },
        path: process.cwd() + '/.dist',
        filename: '[name].js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    optimization: {
       // minimize: false, // we only min specific bundles below
        minimizer: [
            new TerserPlugin({
                test:  /\.min\.js$/,
            }),
        ],
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                use: ['source-map-loader'],
                exclude: [/.*rxjs-compat.*/],
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'ts-loader',
                }]
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                enforce: 'pre',
                use: [{
                    loader: 'tslint-loader',
                    options: {
                        failOnHint: true
                    }
                }]
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: ['.dist'],
            root: process.cwd(),
            verbose: true,
            dry: false
        }),
        new PeerDepsExternalsPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify(mode)
            }
        }),
    ],
};

if (isProduction && path.resolve().includes('packages')) {
    config.plugins.push(
        new CopyPlugin({
            patterns: [
                {
                    from: '../../README.md',
                    to: '../',
                    transform(content, p) {
                        let token = '# Evented State Processor (ESP)';
                        let contentAsString = content.toString();
                        if (!contentAsString.includes(token)) {
                            throw new Error('README missing given token');
                        } else {
                            return contentAsString.replace(token, `# Evented State Processor (ESP) - Package ${path.basename(path.resolve())}`);
                        }
                    },
                }
            ]
        })
    );
}

module.exports = config;